import { useState, useEffect, useCallback, useRef, Component } from "react";
import {
  Menu, X, LogOut, School, Users, Building2, LayoutDashboard, BookOpen,
  ClipboardList, FileBarChart, ScrollText, History, Save, Eye, EyeOff,
  Crown, UserCheck, UserX, Pencil, Trash2, Plus, ShieldCheck, Wallet,
  Landmark, GraduationCap, Layers, Package, ChevronLeft, ChevronRight, Download, ExternalLink,
  LifeBuoy, Printer, Upload, Star, TrendingUp,
} from "lucide-react";
import {
  observarSessao, entrarComGoogle, sair, traduzErroAuth, CODIGO_MESTRE,
} from "./firebaseAuth";
// LOGO_CEDUP removida do projeto — a identidade visual agora usa só ícone +
// tipografia, sem imagem de logo (ver IconeApp abaixo).
import { CONTAS, GRUPOS } from "./contas";

// ============================================================================
// CONSTANTES
// ============================================================================

const TIPOS = ["Aluno", "Professor", "Mestre"];

function defaultPermissoes(tipo) {
  if (tipo === "Mestre") {
    return {
      excluirLancamentos: true, excluirEmpresas: true, excluirUsuarios: true,
      gerenciarTurmas: true, restaurarBackup: true, verAuditoria: true,
      aprovarUsuarios: true,
    };
  }
  if (tipo === "Professor") {
    return {
      excluirLancamentos: true, excluirEmpresas: false, excluirUsuarios: false,
      gerenciarTurmas: true, restaurarBackup: false, verAuditoria: true,
      aprovarUsuarios: false,
    };
  }
  return {
    excluirLancamentos: false, excluirEmpresas: false, excluirUsuarios: false,
    gerenciarTurmas: false, restaurarBackup: false, verAuditoria: false,
    aprovarUsuarios: false,
  };
}

const PERMISSAO_LABELS = {
  gerenciarTurmas: "Gerenciar turmas e empresas",
  excluirLancamentos: "Excluir lançamentos",
  excluirEmpresas: "Excluir empresas",
  excluirUsuarios: "Excluir usuários",
  restaurarBackup: "Restaurar backup",
  verAuditoria: "Ver auditoria",
  aprovarUsuarios: "Aprovar cadastros pendentes",
};

// Módulos que ainda chegam nas próximas fases da migração (Fase 2 em diante).
// Todas as fases da migração já foram implementadas — array mantido vazio
// (em vez de removido) para não quebrar o restante do código que o referencia.
const MODULOS_FUTUROS = [];

const GESTAO_ITENS = [
  { id: "turmas", label: "Turmas", icon: School },
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "usuarios", label: "Usuários", icon: Users },
];

// Módulos que trabalham sempre "dentro" de uma empresa ativa (Fase 2).
const EMPRESA_ITENS = [
  { id: "plano-contas", label: "Plano de Contas", icon: BookOpen },
  { id: "saldos", label: "Saldos Iniciais", icon: Wallet },
  { id: "lancamentos", label: "Lançamentos", icon: ScrollText },
  { id: "razao", label: "Consulta por Conta", icon: Layers },
  { id: "estoque", label: "Controle de Estoque", icon: Package },
  { id: "balancete", label: "Balancete de Verificação", icon: ClipboardList },
  { id: "dre", label: "DRE", icon: FileBarChart },
  { id: "encerramento", label: "Encerramento (ARE)", icon: History },
  { id: "balanco", label: "Balanço Patrimonial", icon: Landmark },
  { id: "relatorios", label: "Relatórios", icon: FileBarChart },
];

// Conteúdo de apoio didático (Fase 4) — não depende de empresa ativa.
const APRENDIZADO_ITENS = [
  { id: "manual", label: "Manual do Aluno", icon: BookOpen },
  { id: "introducao", label: "Introdução à Contabilidade", icon: GraduationCap },
  { id: "manual-professor", label: "Manual do Professor", icon: ShieldCheck },
  { id: "manual-operacionalizacao", label: "Manual de Operacionalização", icon: Landmark },
  { id: "checklist-dev", label: "Checklist de Desenvolvimento", icon: ClipboardList },
];

// Itens do menu "Aprendizado" restritos só ao Administrador (Mestre) —
// nunca aparecem para Aluno nem Professor.
const ITENS_SO_MESTRE = ["manual-operacionalizacao", "checklist-dev"];

// Itens visíveis para todo mundo (Aluno, Professor, Mestre), fora do ciclo
// contábil e da gestão administrativa.
const OUTROS_ITENS = [
  { id: "notas", label: "Notas", icon: Star },
  { id: "suporte", label: "Suporte", icon: LifeBuoy },
];

// Módulos do ciclo contábil que podem receber nota do professor(a) — usados
// no módulo de Notas (avaliação por atividade/módulo).
const MODULOS_AVALIAVEIS = [
  { id: "plano-contas", label: "Plano de Contas" },
  { id: "saldos", label: "Saldos Iniciais" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "estoque", label: "Controle de Estoque" },
  { id: "balancete", label: "Balancete" },
  { id: "dre", label: "DRE" },
  { id: "encerramento", label: "Encerramento" },
  { id: "balanco", label: "Balanço Patrimonial" },
];

// ============================================================================
// HELPERS
// ============================================================================

const uid = (prefixo) => prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fmtDateTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR");
}

// ---- Exportação CSV (Fase 5 — Relatórios e Auditoria) ----
function slug(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
}
function csvEscape(v) {
  const s = String(v == null ? "" : v).replace(/"/g, '""');
  return /[;"\n]/.test(s) ? `"${s}"` : s;
}
function downloadCSV(filename, rows) {
  const csv = "\uFEFF" + rows.map((r) => r.map(csvEscape).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function calcularDVCNPJ(digitos, pesos) {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) soma += digitos[i] * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function gerarCNPJFicticio() {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  const filial = [0, 0, 0, 1];
  const digitos = [...base, ...filial];
  const dv1 = calcularDVCNPJ(digitos, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calcularDVCNPJ([...digitos, dv1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const todos = [...digitos, dv1, dv2].join("");
  return todos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

// ---- Formatação de dinheiro/data e motor de cálculo (Fase 2 — ciclo contábil) ----
function money(n) {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-" : "") + "R$\u00A0" + s;
}

function numFmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "";
  const partes = d.split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return d;
}

function totalDebConta(lancamentos, saldos, codigo) {
  const mov = (lancamentos || []).reduce((s, l) => s + (l.contaDebito === codigo ? Number(l.valor) : 0), 0);
  const ini = Number((saldos?.[codigo] || {}).devedor || 0);
  return mov + ini;
}

function totalCredConta(lancamentos, saldos, codigo) {
  const mov = (lancamentos || []).reduce((s, l) => s + (l.contaCredito === codigo ? Number(l.valor) : 0), 0);
  const ini = Number((saldos?.[codigo] || {}).credor || 0);
  return mov + ini;
}

// Saldo de uma conta respeitando sua natureza (Devedora/Credora), somando saldo
// inicial + movimentação do período — mesma regra do sistema em HTML único.
function saldoConta(lancamentos, saldos, contaByCode, codigo) {
  const conta = contaByCode[codigo];
  const deb = totalDebConta(lancamentos, saldos, codigo);
  const cred = totalCredConta(lancamentos, saldos, codigo);
  if (!conta) return { deb, cred, dev: 0, cre: 0 };
  if (conta.natureza === "Devedora") {
    return deb >= cred ? { deb, cred, dev: deb - cred, cre: 0 } : { deb, cred, dev: 0, cre: cred - deb };
  } else if (conta.natureza === "Credora") {
    return cred >= deb ? { deb, cred, dev: 0, cre: cred - deb } : { deb, cred, dev: deb - cred, cre: 0 };
  }
  return deb >= cred ? { deb, cred, dev: deb - cred, cre: 0 } : { deb, cred, dev: 0, cre: cred - deb };
}

// ---- Totais por prefixo de código (Balancete, DRE, Encerramento, Balanço — Fase 3) ----
function totalDebPrefix(lancamentos, codigo) {
  return (lancamentos || []).reduce(
    (s, l) => s + (l.contaDebito && l.contaDebito.startsWith(codigo + ".") ? Number(l.valor) : 0),
    0
  );
}
function totalCredPrefix(lancamentos, codigo) {
  return (lancamentos || []).reduce(
    (s, l) => s + (l.contaCredito && l.contaCredito.startsWith(codigo + ".") ? Number(l.valor) : 0),
    0
  );
}
function saldoInicialPrefixSide(saldos, prefixo, lado) {
  let s = 0;
  for (const cod in saldos || {}) {
    if (cod.startsWith(prefixo + ".")) s += Number((saldos[cod] || {})[lado] || 0);
  }
  return s;
}
function debMinusCredPrefix(lancamentos, saldos, prefixo) {
  const mov = totalDebPrefix(lancamentos, prefixo) - totalCredPrefix(lancamentos, prefixo);
  const ini = saldoInicialPrefixSide(saldos, prefixo, "devedor") - saldoInicialPrefixSide(saldos, prefixo, "credor");
  return mov + ini;
}
function credMinusDebPrefix(lancamentos, saldos, prefixo) {
  const mov = totalCredPrefix(lancamentos, prefixo) - totalDebPrefix(lancamentos, prefixo);
  const ini = saldoInicialPrefixSide(saldos, prefixo, "credor") - saldoInicialPrefixSide(saldos, prefixo, "devedor");
  return mov + ini;
}

// ---- Árvore analítica do Balanço Patrimonial (Grupo → Subgrupo → Conta
// Sintética → Conta Analítica) — Fase 6 ----
function codigoPai(codigo) {
  const partes = codigo.split(".");
  if (partes.length <= 1) return null;
  return partes.slice(0, -1).join(".");
}

// Valor próprio de uma conta (sem contar subcontas), na direção natural do
// lado do Balanço em que ela está: Ativo → devedor líquido; Passivo/PL →
// credor líquido. Só é relevante para contas que aceitam lançamento direto.
function valorProprioConta(lancamentos, saldos, codigo, ladoAtivo) {
  const deb = totalDebConta(lancamentos, saldos, codigo);
  const cred = totalCredConta(lancamentos, saldos, codigo);
  return ladoAtivo ? deb - cred : cred - deb;
}

// Valor de uma conta somando ela própria (se aceitar lançamento) com todas as
// contas abaixo dela na hierarquia.
function valorContaComDescendentes(lancamentos, saldos, conta, ladoAtivo) {
  const descendentes = ladoAtivo
    ? debMinusCredPrefix(lancamentos, saldos, conta.codigo)
    : credMinusDebPrefix(lancamentos, saldos, conta.codigo);
  const proprio = conta.aceitaLancamento ? valorProprioConta(lancamentos, saldos, conta.codigo, ladoAtivo) : 0;
  return descendentes + proprio;
}

// Monta a árvore de um ramo do plano de contas (ex.: "1" = Ativo), calcula o
// valor de cada nó e poda os ramos sem saldo (valor zero e sem filhos com
// saldo) — assim o Balanço mostra só o que tem movimento, mas de forma
// hierárquica (grupo/subgrupo/sintética/analítica).
function construirArvoreBalanco(contas, codigoRaiz, lancamentos, saldos, ladoAtivo) {
  const doRamo = (contas || []).filter((c) => c.codigo === codigoRaiz || c.codigo.startsWith(codigoRaiz + "."));
  const porCodigo = {};
  doRamo.forEach((c) => { porCodigo[c.codigo] = { conta: c, filhos: [], valor: 0 }; });
  doRamo.forEach((c) => {
    if (c.codigo === codigoRaiz) return;
    const pai = codigoPai(c.codigo);
    if (pai && porCodigo[pai]) porCodigo[pai].filhos.push(porCodigo[c.codigo]);
  });
  Object.values(porCodigo).forEach((n) =>
    n.filhos.sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo, undefined, { numeric: true }))
  );
  const raiz = porCodigo[codigoRaiz];
  if (!raiz) return null;

  const calcular = (no) => {
    no.filhos.forEach(calcular);
    no.valor = valorContaComDescendentes(lancamentos, saldos, no.conta, ladoAtivo);
  };
  calcular(raiz);

  const podar = (no) => {
    no.filhos = no.filhos.filter((f) => {
      podar(f);
      return Math.abs(f.valor) >= 0.005 || f.filhos.length > 0;
    });
  };
  podar(raiz);

  return raiz;
}

// DRE completa conforme a Lei nº 6.404/76 — mesma cadeia de cálculo do sistema original.
function computeDRE(lancamentos, saldos) {
  const receitaBruta = credMinusDebPrefix(lancamentos, saldos, "4.1.1");
  const deducoes = credMinusDebPrefix(lancamentos, saldos, "4.2");
  const receitaLiquida = receitaBruta + deducoes;
  const cmv = -debMinusCredPrefix(lancamentos, saldos, "6.2");
  const resultadoBruto = receitaLiquida + cmv;
  const despAdm = -debMinusCredPrefix(lancamentos, saldos, "5.1");
  const despCom = -debMinusCredPrefix(lancamentos, saldos, "5.2");
  const outrasReceitasOp = credMinusDebPrefix(lancamentos, saldos, "4.4");
  const resAntesFin = resultadoBruto + despAdm + despCom + outrasReceitasOp;
  const receitasFin = credMinusDebPrefix(lancamentos, saldos, "4.3");
  const despFin = -debMinusCredPrefix(lancamentos, saldos, "5.3");
  const resOperacional = resAntesFin + receitasFin + despFin;
  const ganhosCapital = credMinusDebPrefix(lancamentos, saldos, "4.5") + credMinusDebPrefix(lancamentos, saldos, "4.6");
  const outrasDesp = -debMinusCredPrefix(lancamentos, saldos, "5.4");
  const resAntesIRPJ = resOperacional + ganhosCapital + outrasDesp;
  const provIRPJCSLL = -debMinusCredPrefix(lancamentos, saldos, "7.2");
  const resultadoLiquido = resAntesIRPJ + provIRPJCSLL;
  return {
    receitaBruta, deducoes, receitaLiquida, cmv, resultadoBruto, despAdm, despCom, outrasReceitasOp,
    resAntesFin, receitasFin, despFin, resOperacional, ganhosCapital, outrasDesp, resAntesIRPJ,
    provIRPJCSLL, resultadoLiquido,
  };
}

// ============================================================================
// ACESSO A DADOS — usuários em documentos individuais (Seção 7-H do manual);
// turmas e empresas em listas compartilhadas simples (telas administrativas
// de baixo volume de edição simultânea).
// ============================================================================

async function salvarUsuario(perfil) {
  await window.storage.set(`usuario_${perfil.uid}`, JSON.stringify(perfil), true);
}

async function buscarUsuario(uidAlvo) {
  try {
    const r = await window.storage.get(`usuario_${uidAlvo}`, true);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}

async function atualizarUsuario(uidAlvo, mudancas) {
  const atual = await buscarUsuario(uidAlvo);
  if (!atual) return null;
  const novo = { ...atual, ...mudancas };
  await salvarUsuario(novo);
  return novo;
}

async function excluirUsuarioDoc(uidAlvo) {
  try {
    await window.storage.delete(`usuario_${uidAlvo}`, true);
  } catch {}
}

async function listarUsuarios() {
  try {
    const idx = await window.storage.list("usuario_", true);
    const chaves = idx?.keys || [];
    const resultados = await Promise.all(
      chaves.map(async (k) => {
        try {
          const r = await window.storage.get(k, true);
          return r ? JSON.parse(r.value) : null;
        } catch {
          return null;
        }
      })
    );
    return resultados.filter(Boolean);
  } catch {
    return [];
  }
}

function useUsuario(uidAlvo) {
  const [perfil, setPerfil] = useState(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!uidAlvo) {
      setPerfil(null);
      return;
    }
    let vivo = true;
    (async () => {
      setPerfil(undefined);
      const p = await buscarUsuario(uidAlvo);
      if (vivo) setPerfil(p);
    })();
    return () => {
      vivo = false;
    };
  }, [uidAlvo, refreshKey]);
  const recarregar = useCallback(() => setRefreshKey((k) => k + 1), []);
  return [perfil, recarregar];
}

function useListaUsuarios(refreshKey) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await listarUsuarios();
      if (vivo) setLista(r);
    })();
    return () => {
      vivo = false;
    };
  }, [refreshKey]);
  return lista;
}

// defaultValue: [] para listas (turmas, empresas, lançamentos) ou {} para mapas
// (saldos iniciais por código de conta). key=null/undefined pula a busca — usado
// quando ainda não há uma empresa ativa selecionada (módulos da Fase 2).
function useSharedList(key, defaultValue = []) {
  const [valor, setValor] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!key) {
      setValor(null);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const r = await window.storage.get(key, true);
        if (vivo) setValor(r ? JSON.parse(r.value) : defaultValue);
      } catch {
        if (vivo) setValor(defaultValue);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [key, refreshKey]);

  const salvar = useCallback(
    async (novo) => {
      if (!key) return;
      setValor(novo);
      try {
        await window.storage.set(key, JSON.stringify(novo), true);
      } catch {}
    },
    [key]
  );

  const recarregar = useCallback(() => setRefreshKey((k) => k + 1), []);

  return [valor, salvar, recarregar];
}

// ============================================================================
// COMPONENTES DE UI BÁSICOS
// ============================================================================

function Field({ label, children, hint }) {
  return (
    <label className="block mb-3">
      {label && <div className="text-sm font-medium text-inkSoft mb-1">{label}</div>}
      {children}
      {hint && <div className="text-xs text-inkSoft/70 mt-1">{hint}</div>}
    </label>
  );
}

function TxtInput(props) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-lg border border-line bg-paperRaised px-3 py-2 text-sm text-ink " +
        "outline-none focus:border-green focus:ring-1 focus:ring-green " +
        (props.className || "")
      }
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-lg border border-line bg-paperRaised px-3 py-2 text-sm text-ink " +
        "outline-none focus:border-green focus:ring-1 focus:ring-green " +
        (props.className || "")
      }
    >
      {children}
    </select>
  );
}

function Botao({ children, variant = "primary", className = "", ...props }) {
  const base = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors";
  const estilos = {
    primary: "bg-green text-white hover:bg-ink",
    ghost: "bg-transparent text-ink border border-line hover:bg-paperRaised",
    danger: "bg-red text-white hover:opacity-90",
    gold: "bg-gold text-white hover:opacity-90",
  };
  return (
    <button className={`${base} ${estilos[variant] || estilos.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-paperRaised border border-line rounded-xl shadow-soft p-5 ${className}`}>
      {children}
    </div>
  );
}

// Identidade visual do sistema — sem imagem de logo, só ícone + cores da
// paleta (verde/dourado). "tamanho" controla o tamanho do quadrado/ícone.
function IconeApp({ tamanho = "w-16 h-16", iconeTamanho = 30, className = "" }) {
  return (
    <div
      className={`${tamanho} ${className} rounded-xl bg-green flex items-center justify-center shrink-0 shadow-sm`}
    >
      <Landmark size={iconeTamanho} className="text-gold" strokeWidth={1.75} />
    </div>
  );
}

function Pill({ children, tone = "green" }) {
  const tons = {
    green: "bg-green/10 text-green border-green/30",
    gold: "bg-gold/10 text-gold border-gold/30",
    red: "bg-red/10 text-red border-red/30",
    default: "bg-inkSoft/10 text-inkSoft border-inkSoft/30",
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${tons[tone]}`}>
      {children}
    </span>
  );
}

function LoadingScreen({ texto = "Carregando…" }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center">
        <IconeApp tamanho="w-16 h-16" iconeTamanho={30} className="mx-auto mb-4" />
        <div className="text-inkSoft text-sm font-serif">{texto}</div>
      </div>
    </div>
  );
}

function CampoSenha({ value, onChange, placeholder }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <TxtInput
        type={ver ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-inkSoft"
        tabIndex={-1}
      >
        {ver ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// ============================================================================
// TELAS DE AUTENTICAÇÃO
// ============================================================================

// Ícone oficial "G" do Google, nas 4 cores — uso padrão em botões de
// "Entrar com Google" (segue as diretrizes de marca do próprio Google).
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.71-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.7c-.18-.54-.28-1.12-.28-1.7s.1-1.16.28-1.7V4.96H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.04l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function TelaLogin() {
  const [perfilTab, setPerfilTab] = useState("Aluno");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleGoogle = async () => {
    setErro("");
    setCarregando(true);
    try {
      // Guarda em sessionStorage (sobrevive ao popup do Google) qual perfil a
      // pessoa pretende ter — usado depois, se for o primeiro login dela, para
      // decidir entre a tela de Matrícula (Aluno) ou Código de Mestre (Professor).
      sessionStorage.setItem("perfilPretendido", perfilTab);
      await entrarComGoogle();
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setErro(traduzErroAuth(err.code));
      }
    } finally {
      setCarregando(false);
    }
  };

  const destaques = [
    { icon: Layers, texto: "9 módulos do ciclo contábil — do Plano de Contas ao Balanço Patrimonial" },
    { icon: Building2, texto: "Cada aluno constrói e administra sua própria empresa individual" },
    { icon: ClipboardList, texto: "Atividades avaliativas com correção automática e notas" },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Coluna institucional — some em telas pequenas, aparece a partir de md */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-ink text-white flex-col justify-between p-10 lg:p-14">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <IconeApp tamanho="w-11 h-11" iconeTamanho={22} />
            <div className="text-xs uppercase tracking-wide text-gold font-semibold">
              CEDUP Hermann Hering
              <div className="text-white/50 font-normal normal-case">Curso Técnico em Contabilidade</div>
            </div>
          </div>
          <h1 className="font-serif font-bold text-4xl lg:text-5xl leading-tight mb-4">
            Sistema de Escrituração Contábil
          </h1>
          <p className="text-white/70 text-base lg:text-lg max-w-md mb-10">
            Do lançamento ao fechamento — pratique contabilidade construindo e administrando uma
            empresa simulada, passo a passo.
          </p>
          <div className="flex items-end gap-1.5 mb-10 h-16">
            {[40, 55, 45, 70, 60, 85, 100].map((h, i) => (
              <div
                key={i}
                className="w-3.5 rounded-t bg-gold/80"
                style={{ height: `${h}%`, opacity: 0.5 + i * 0.07 }}
              />
            ))}
          </div>
          <div className="space-y-4">
            {destaques.map(({ icon: Icone, texto }) => (
              <div key={texto} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icone size={16} className="text-gold" />
                </div>
                <p className="text-sm text-white/80 leading-snug pt-1">{texto}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/40 mt-10">
          © 2026 Prof. Esp. Jorge Lima Cardoso. Todos os direitos reservados. Plataforma didática
          desenvolvida para o CEDUP Hermann Hering — Curso Técnico em Contabilidade.
        </p>
      </div>

      {/* Coluna de login */}
      <div className="flex-1 flex items-center justify-center bg-paper px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6 md:hidden">
            <IconeApp tamanho="w-16 h-16" iconeTamanho={30} className="mx-auto mb-3" />
            <h1 className="text-xl font-serif font-semibold text-ink">Sistema de Escrituração Contábil</h1>
            <p className="text-xs text-inkSoft mt-1">CEDUP Hermann Hering · Curso Técnico em Contabilidade</p>
          </div>
          <Card>
            <h2 className="font-serif font-semibold text-ink text-lg mb-1">Entrar no sistema</h2>
            <p className="text-xs text-inkSoft mb-5">Entre com sua conta Google para acessar a plataforma.</p>
            <div className="text-xs text-inkSoft uppercase tracking-wide mb-2">Perfil de acesso</div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setPerfilTab("Aluno")}
                className={
                  "px-3 py-2 rounded-lg text-sm font-semibold border transition-colors " +
                  (perfilTab === "Aluno" ? "bg-green text-white border-green" : "border-line text-inkSoft hover:text-ink")
                }
              >
                Aluno(a)
              </button>
              <button
                type="button"
                onClick={() => setPerfilTab("Professor")}
                className={
                  "px-3 py-2 rounded-lg text-sm font-semibold border transition-colors " +
                  (perfilTab === "Professor" ? "bg-green text-white border-green" : "border-line text-inkSoft hover:text-ink")
                }
              >
                Professor(a)
              </button>
            </div>
            <p className="text-xs text-inkSoft mb-4">
              {perfilTab === "Aluno"
                ? "Depois de entrar com o Google, vamos pedir sua matrícula para vincular à turma certa."
                : "Depois de entrar com o Google, se você tiver um Código de Mestre, vai poder informá-lo."}
            </p>
            {erro && <div className="text-sm text-red mb-3">{erro}</div>}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={carregando}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line bg-white text-ink text-sm font-semibold hover:bg-paper transition-colors disabled:opacity-60"
            >
              <GoogleIcon />
              {carregando ? "Entrando…" : "Continuar com o Google"}
            </button>
          </Card>
          <p className="text-xs text-inkSoft text-center mt-4">
            Autenticado via Firebase Authentication — sempre conta Google.
          </p>
        </div>
      </div>
    </div>
  );
}

// Primeiro login de um Professor(a) via Google — ainda não existe perfil no
// Firestore. Só pede o Código de Mestre (opcional); sem ele, vira Professor
// pendente de aprovação por um Mestre.
function TelaCompletarProfessor({ user, onConcluido }) {
  const [codigoMestre, setCodigoMestre] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const virouMestre = codigoMestre.trim() && codigoMestre.trim() === CODIGO_MESTRE;
      const tipoFinal = virouMestre ? "Mestre" : "Professor";
      const perfil = {
        uid: user.uid,
        nome: user.displayName || user.email,
        email: user.email,
        tipo: tipoFinal,
        turmaId: null,
        permissoes: defaultPermissoes(tipoFinal),
        aprovado: virouMestre,
        criadoEm: Date.now(),
      };
      await salvarUsuario(perfil);
      sessionStorage.removeItem("perfilPretendido");
      onConcluido();
    } catch {
      setErro("Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <IconeApp tamanho="w-16 h-16" iconeTamanho={30} className="mx-auto mb-3" />
          <h1 className="text-xl font-serif font-semibold text-ink">Complete seu cadastro</h1>
          <p className="text-xs text-inkSoft mt-1">
            Entrando como {user.displayName || user.email} — Professor(a).
          </p>
        </div>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Código de Mestre (opcional)" hint="Só preencha se um Usuário Mestre te passou este código.">
              <TxtInput value={codigoMestre} onChange={(e) => setCodigoMestre(e.target.value)} />
            </Field>
            {erro && <div className="text-sm text-red mb-3">{erro}</div>}
            <Botao type="submit" disabled={carregando} className="w-full justify-center">
              {carregando ? "Concluindo…" : "Concluir cadastro"}
            </Botao>
          </form>
        </Card>
        <button onClick={sair} className="text-sm text-inkSoft underline block mt-4 mx-auto">
          Cancelar e sair
        </button>
      </div>
    </div>
  );
}

// Primeiro login de um Aluno(a) via Google — pede a Matrícula e procura, em
// todas as turmas, um registro de "aluno esperado" com essa matrícula
// (cadastrado antes pelo professor — ver GestaoTurmasView). Se achar, o
// cadastro já entra aprovado (o professor já vinculou/autorizou ao registrar
// a matrícula). Se não achar, orienta a procurar o professor.
function TelaCompletarAluno({ user, turmas, empresas, salvarEmpresas, onConcluido }) {
  const [matricula, setMatricula] = useState("");
  const [erro, setErro] = useState("");
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [jaVinculada, setJaVinculada] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setNaoEncontrada(false);
    setJaVinculada(false);
    const mat = matricula.trim();
    if (!mat) {
      setErro("Informe sua matrícula.");
      return;
    }
    setCarregando(true);
    try {
      // Cada matrícula só pode estar vinculada a UMA Conta Google. Se algum
      // outro usuário (uid diferente do atual, que ainda não tem perfil)
      // já usa essa matrícula, bloqueia — só um Professor/Mestre pode
      // desfazer esse vínculo (ver módulo Usuários).
      const todosUsuarios = await listarUsuarios();
      const conflito = todosUsuarios.find((u) => u.matricula === mat && u.uid !== user.uid);
      if (conflito) {
        setJaVinculada(true);
        setCarregando(false);
        return;
      }

      let turmaEncontrada = null;
      let nomeEncontrado = null;
      for (const t of turmas || []) {
        const registro = (t.alunosEsperados || []).find((a) => a.matricula === mat);
        if (registro) {
          turmaEncontrada = t;
          nomeEncontrado = registro.nome;
          break;
        }
      }
      if (!turmaEncontrada) {
        setNaoEncontrada(true);
        setCarregando(false);
        return;
      }
      const nomeFinal = nomeEncontrado || user.displayName || user.email;
      const perfil = {
        uid: user.uid,
        nome: nomeFinal,
        email: user.email,
        tipo: "Aluno",
        matricula: mat,
        turmaId: turmaEncontrada.id,
        permissoes: defaultPermissoes("Aluno"),
        aprovado: true,
        criadoEm: Date.now(),
      };
      await salvarUsuario(perfil);

      // Empresa individual criada automaticamente no primeiro acesso — só o
      // nome vem preenchido ("Nome Completo LTDA"); o resto fica em branco
      // para o próprio aluno preencher junto com as atividades da turma.
      const jaTemEmpresa = (empresas || []).some((em) => em.alunoId === user.uid);
      if (!jaTemEmpresa) {
        const novaEmpresa = {
          id: uid("emp"),
          nome: `${nomeFinal} LTDA`,
          cnpj: "",
          atividade: "",
          responsavel: "",
          alunoId: user.uid,
          turmaId: turmaEncontrada.id,
          criadoEm: Date.now(),
        };
        await salvarEmpresas([...(empresas || []), novaEmpresa]);
      }

      sessionStorage.removeItem("perfilPretendido");
      onConcluido();
    } catch {
      setErro("Não foi possível concluir. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <IconeApp tamanho="w-16 h-16" iconeTamanho={30} className="mx-auto mb-3" />
          <h1 className="text-xl font-serif font-semibold text-ink">Olá, {user.displayName || user.email}!</h1>
          <p className="text-xs text-inkSoft mt-1">Informe sua matrícula para entrar na sua turma.</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Matrícula">
              <TxtInput
                required
                value={matricula}
                onChange={(e) => {
                  setMatricula(e.target.value);
                  setNaoEncontrada(false);
                  setJaVinculada(false);
                }}
                placeholder="Ex.: 2024001"
              />
            </Field>
            {erro && <div className="text-sm text-red mb-3">{erro}</div>}
            {naoEncontrada && (
              <div className="text-sm text-ink bg-gold/10 border border-gold/40 rounded-lg p-3 mb-3">
                Não encontramos essa matrícula vinculada a nenhuma turma. Procure seu professor(a) e peça para
                cadastrá-la antes de tentar entrar de novo.
              </div>
            )}
            {jaVinculada && (
              <div className="text-sm text-ink bg-red/10 border border-red/40 rounded-lg p-3 mb-3">
                Essa matrícula já está vinculada a outra Conta Google. Se você tem certeza de que é sua
                matrícula, procure seu professor(a) ou um Administrador para verificar e, se necessário,
                refazer o vínculo.
              </div>
            )}
            <Botao type="submit" disabled={carregando} className="w-full justify-center">
              {carregando ? "Entrando…" : "Entrar"}
            </Botao>
          </form>
        </Card>
        <button onClick={sair} className="text-sm text-inkSoft underline block mt-4 mx-auto">
          Cancelar e sair
        </button>
      </div>
    </div>
  );
}

// Router do primeiro login — decide entre a tela de Professor ou de Aluno
// conforme o que a pessoa escolheu na TelaLogin (guardado em sessionStorage).
function TelaCompletarCadastroGoogle({ user, turmas, empresas, salvarEmpresas, onConcluido }) {
  const perfilPretendido = sessionStorage.getItem("perfilPretendido") || "Aluno";
  if (perfilPretendido === "Professor") {
    return <TelaCompletarProfessor user={user} onConcluido={onConcluido} />;
  }
  return (
    <TelaCompletarAluno
      user={user}
      turmas={turmas}
      empresas={empresas}
      salvarEmpresas={salvarEmpresas}
      onConcluido={onConcluido}
    />
  );
}

// Gate de acesso administrativo — pedido a CADA entrada de um usuário Mestre
// (mesmo já autenticado pelo Google), nunca fica salvo entre sessões.
function TelaSenhaMestre({ onDesbloquear }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (senha === CODIGO_MESTRE) {
      onDesbloquear();
    } else {
      setErro("Senha mestre incorreta.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <IconeApp tamanho="w-16 h-16" iconeTamanho={30} className="mx-auto mb-3" />
          <h1 className="text-xl font-serif font-semibold text-ink">Acesso administrativo</h1>
          <p className="text-xs text-inkSoft mt-1">Digite a senha mestre para continuar como Mestre.</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Senha mestre">
              <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
            </Field>
            {erro && <div className="text-sm text-red mb-3">{erro}</div>}
            <Botao type="submit" className="w-full justify-center">
              Confirmar
            </Botao>
          </form>
        </Card>
        <button onClick={sair} className="text-sm text-inkSoft underline block mt-4 mx-auto">
          Sair
        </button>
      </div>
    </div>
  );
}

// Confirmação de matrícula a cada entrada do Aluno — igual em espírito à
// senha mestre do Mestre: reforça a segurança e confirma a identidade,
// mesmo que a conta Google já esteja autenticada. Nunca fica salva entre
// sessões (chamado de suporte "Login + matrícula").
function TelaConfirmarMatricula({ perfil, onDesbloquear }) {
  const [matricula, setMatricula] = useState("");
  const [erro, setErro] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (matricula.trim() === perfil.matricula) {
      onDesbloquear();
    } else {
      setErro("Matrícula incorreta. Confira e tente de novo.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <IconeApp tamanho="w-16 h-16" iconeTamanho={30} className="mx-auto mb-3" />
          <h1 className="text-xl font-serif font-semibold text-ink">Confirme sua matrícula</h1>
          <p className="text-xs text-inkSoft mt-1">
            Olá, {perfil.nome} — por segurança, confirme sua matrícula a cada entrada.
          </p>
        </div>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Matrícula">
              <TxtInput
                required
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Ex.: 2024001"
              />
            </Field>
            {erro && <div className="text-sm text-red mb-3">{erro}</div>}
            <Botao type="submit" className="w-full justify-center">
              Confirmar
            </Botao>
          </form>
        </Card>
        <button onClick={sair} className="text-sm text-inkSoft underline block mt-4 mx-auto">
          Sair
        </button>
      </div>
    </div>
  );
}


function TelaAguardandoAprovacao({ perfil }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm text-center">
        <IconeApp tamanho="w-16 h-16" iconeTamanho={30} className="mx-auto mb-4" />
        <h1 className="text-lg font-serif font-semibold text-ink mb-2">Cadastro em análise</h1>
        <p className="text-sm text-inkSoft mb-6">
          Olá, {perfil?.nome || "tudo bem"}! Seu cadastro como <b>{perfil?.tipo}</b> foi recebido e está aguardando
          aprovação de um Usuário Mestre. Assim que for aprovado, você poderá entrar normalmente.
        </p>
        <Botao variant="ghost" onClick={sair}>
          <LogOut size={16} /> Sair
        </Botao>
      </div>
    </div>
  );
}

// ============================================================================
// LAYOUT PRINCIPAL (menu responsivo em gaveta no celular)
// ============================================================================

function Layout({ perfil, aba, setAba, podeVoltar, aoVoltar, children }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const irPara = (id) => {
    setAba(id);
    setMenuAberto(false);
  };

  const temPermissao = (flag) => !!perfil?.permissoes?.[flag];
  const pendentesVisiveis = temPermissao("aprovarUsuarios");

  return (
    <div className="min-h-screen flex bg-paper relative">
      <header className="md:hidden fixed top-0 inset-x-0 z-20 bg-ink text-white flex items-center justify-between px-4 py-3">
        <span className="font-serif font-semibold text-sm">Sistema Contábil</span>
        <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
          <Menu size={22} />
        </button>
      </header>

      {menuAberto && (
        <div onClick={() => setMenuAberto(false)} className="md:hidden fixed inset-0 bg-black/50 z-30" />
      )}

      <aside
        className={
          "w-72 bg-ink text-white flex flex-col shrink-0 fixed inset-y-0 left-0 z-40 " +
          "transition-transform duration-200 md:static md:translate-x-0 overflow-y-auto " +
          (menuAberto ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <IconeApp tamanho="w-10 h-10" iconeTamanho={20} />
          <div>
            <div className="font-serif font-semibold text-sm leading-tight">Sistema Contábil</div>
            <div className="text-[11px] text-white/60">CEDUP Hermann Hering</div>
          </div>
          <button className="md:hidden ml-auto" onClick={() => setMenuAberto(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-3">
          <button
            onClick={() => irPara("capa")}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
              aba === "capa" ? "bg-white/10 text-gold font-semibold" : "text-white/85"
            }`}
          >
            <LayoutDashboard size={17} /> Início
          </button>

          {perfil?.tipo !== "Aluno" && (
            <>
              <div className="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">Gestão</div>
              {GESTAO_ITENS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => irPara(item.id)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
                    aba === item.id ? "bg-white/10 text-gold font-semibold" : "text-white/85"
                  }`}
                >
                  <item.icon size={17} /> {item.label}
                </button>
              ))}
              {pendentesVisiveis && (
                <button
                  onClick={() => irPara("aprovacoes")}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
                    aba === "aprovacoes" ? "bg-white/10 text-gold font-semibold" : "text-white/85"
                  }`}
                >
                  <Crown size={17} /> Aprovações
                </button>
              )}
            </>
          )}

          <div className="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">Aprendizado</div>
          {APRENDIZADO_ITENS.filter(
            (item) =>
              !(item.id === "manual-professor" && perfil?.tipo === "Aluno") &&
              !(ITENS_SO_MESTRE.includes(item.id) && perfil?.tipo !== "Mestre")
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => irPara(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
                aba === item.id ? "bg-white/10 text-gold font-semibold" : "text-white/85"
              }`}
            >
              <item.icon size={17} /> {item.label}
            </button>
          ))}

          <div className="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">Ciclo Contábil</div>
          {EMPRESA_ITENS.map((item) => (
            <button
              key={item.id}
              onClick={() => irPara(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
                aba === item.id ? "bg-white/10 text-gold font-semibold" : "text-white/85"
              }`}
            >
              <item.icon size={17} /> {item.label}
            </button>
          ))}

          {(temPermissao("verAuditoria") || perfil?.tipo === "Mestre" || perfil?.tipo === "Professor") && (
            <div className="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">Sistema</div>
          )}
          {temPermissao("verAuditoria") && (
            <button
              onClick={() => irPara("auditoria")}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
                aba === "auditoria" ? "bg-white/10 text-gold font-semibold" : "text-white/85"
              }`}
            >
              <Eye size={17} /> Auditoria
            </button>
          )}
          {(perfil?.tipo === "Mestre" || perfil?.tipo === "Professor") && (
            <button
              onClick={() => irPara("backup")}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
                aba === "backup" ? "bg-white/10 text-gold font-semibold" : "text-white/85"
              }`}
            >
              <Save size={17} /> Backup
            </button>
          )}

          <div className="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">Outros</div>
          {OUTROS_ITENS.map((item) => (
            <button
              key={item.id}
              onClick={() => irPara(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
                aba === item.id ? "bg-white/10 text-gold font-semibold" : "text-white/85"
              }`}
            >
              <item.icon size={17} /> {item.label}
            </button>
          ))}

          {MODULOS_FUTUROS.length > 0 && (
            <div className="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">
              Módulos (próximas fases)
            </div>
          )}
          {MODULOS_FUTUROS.map((item) => (
            <button
              key={item.id}
              onClick={() => irPara(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left hover:bg-white/10 ${
                aba === item.id ? "bg-white/10 text-gold font-semibold" : "text-white/50"
              }`}
            >
              <item.icon size={17} /> {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/70 mb-1">{perfil?.nome}</div>
          <div className="flex items-center gap-2 mb-3">
            <Pill tone={perfil?.tipo === "Mestre" ? "gold" : "green"}>{perfil?.tipo}</Pill>
          </div>
          <button onClick={sair} className="flex items-center gap-2 text-xs text-white/70 hover:text-white">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 pt-20 md:p-8 md:pt-8 min-w-0">
        <div className="max-w-5xl mx-auto">
          {podeVoltar && (
            <button
              onClick={aoVoltar}
              className="flex items-center gap-1.5 text-sm text-inkSoft hover:text-green mb-4 -ml-1"
            >
              <ChevronLeft size={18} /> Voltar
            </button>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function Capa({ perfil, setAba, contagens }) {
  const souAluno = perfil?.tipo === "Aluno";
  const aprendizadoVisivel = souAluno
    ? APRENDIZADO_ITENS.filter((item) => item.id !== "manual-professor" && !ITENS_SO_MESTRE.includes(item.id))
    : APRENDIZADO_ITENS;
  const cardsModulos = souAluno ? [...aprendizadoVisivel, ...EMPRESA_ITENS] : GESTAO_ITENS;

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-gold font-semibold mb-1">
          CEDUP Hermann Hering · Curso Técnico em Contabilidade
        </div>
        <h1 className="text-2xl font-serif font-semibold text-ink">Sistema de Escrituração Contábil</h1>
        <p className="text-sm text-inkSoft mt-1 max-w-2xl">
          Bem-vindo(a), {perfil?.nome}. A plataforma está em migração para React + Firebase — a fundação
          (login, turmas, empresas e usuários) e todo o ciclo contábil (Plano de Contas, Saldos
          Iniciais, Lançamentos, Consulta por Conta, Balancete, DRE, Encerramento e Balanço
          Patrimonial) já estão no ar e sincronizados em qualquer dispositivo.
        </p>
      </div>

      {!souAluno && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Card>
            <div className="text-xs text-inkSoft">Turmas</div>
            <div className="text-2xl font-serif font-semibold text-ink">{contagens.turmas}</div>
          </Card>
          <Card>
            <div className="text-xs text-inkSoft">Empresas</div>
            <div className="text-2xl font-serif font-semibold text-ink">{contagens.empresas}</div>
          </Card>
          <Card>
            <div className="text-xs text-inkSoft">Usuários aprovados</div>
            <div className="text-2xl font-serif font-semibold text-ink">{contagens.usuarios}</div>
          </Card>
          <Card>
            <div className="text-xs text-inkSoft">Cadastros pendentes</div>
            <div className="text-2xl font-serif font-semibold text-ink">{contagens.pendentes}</div>
          </Card>
        </div>
      )}

      <Card>
        <h3 className="font-serif font-semibold text-ink mb-3">
          {souAluno ? "Seus módulos" : "Módulos disponíveis nesta fase"}
        </h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {cardsModulos.map((item) => (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              className="text-left border border-line rounded-lg p-3 hover:border-green transition-colors"
            >
              <item.icon size={18} className="text-green mb-2" />
              <div className="text-sm font-semibold text-ink">{item.label}</div>
            </button>
          ))}
        </div>
        <div className="text-xs text-inkSoft mt-4">
          Introdução à Contabilidade, Manual do Aluno, Relatórios e Backup chegam nas próximas fases
          da migração — já estão listados no menu como "em breve".
        </div>
      </Card>
    </div>
  );
}

function ModuloEmBreve({ modulo }) {
  return (
    <Card>
      <h2 className="text-lg font-serif font-semibold text-ink mb-2">{modulo.label}</h2>
      <p className="text-sm text-inkSoft">
        Este módulo ainda não foi migrado — está previsto para a <b>Fase {modulo.fase}</b> do plano de
        migração. Por enquanto, ele continua disponível na versão publicada em HTML único, se você ainda
        precisar dele.
      </p>
    </Card>
  );
}

// ============================================================================
// GESTÃO — TURMAS
// ============================================================================

// Extrai o texto de um PDF no navegador (via pdf.js, carregado sob demanda de
// um CDN — não precisa instalar nada no projeto) e tenta reconhecer pares
// "Nome + Matrícula", uma linha por aluno. Sempre mostra uma prévia editável
// antes de importar de verdade, porque o reconhecimento é uma estimativa —
// depende muito do formato exato do PDF exportado pela escola.
async function extrairTextoPdf(arquivo) {
  const pdfjsLib = await import("https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs";
  const buf = await arquivo.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const conteudo = await pagina.getTextContent();
    texto += conteudo.items.map((it) => it.str).join(" ") + "\n";
  }
  return texto;
}

function parsearAlunosDoTexto(textoOriginal) {
  // Vários sistemas escolares (ex.: professoronline.sed.sc.gov.br) exportam
  // PDFs em que a camada de texto duplica nome/matrícula/data lado a lado
  // (provavelmente por causa de um recurso de tooltip "passe o mouse sobre o
  // nome"). Por isso tentamos primeiro reconhecer o padrão de tabela
  // "Nº Nome Matrícula", com cada campo podendo (ou não) vir duplicado.
  const texto = textoOriginal.replace(/\s+/g, " ").trim();
  const NOME = "A-Za-zÀ-ÖØ-öø-ÿ";
  const regexTabela = new RegExp(
    `(\\d{1,3})\\s+\\1\\s+([${NOME}][${NOME}\\s'.-]{2,80}?)(?:\\s+\\2)?\\s+(\\d{6,})(?:\\s+\\3)?`,
    "g"
  );
  let resultado = [];
  let vistos = new Set();
  let m;
  while ((m = regexTabela.exec(texto)) !== null) {
    const nome = m[2].replace(/\s+/g, " ").trim();
    const matricula = m[3];
    if (nome.length >= 3 && !vistos.has(matricula)) {
      resultado.push({ nome, matricula });
      vistos.add(matricula);
    }
  }
  if (resultado.length > 0) return resultado;

  // Sem número de linha na frente (ex.: "Nome ... Matrícula", sem índice) —
  // mesma lógica, mas sem exigir "Nº Nº" no início.
  const regexSemIndice = new RegExp(
    `([${NOME}][${NOME}\\s'.-]{2,80}?)(?:\\s+\\1)?\\s+(\\d{6,})(?:\\s+\\2)?`,
    "g"
  );
  vistos = new Set();
  while ((m = regexSemIndice.exec(texto)) !== null) {
    const nome = m[1].replace(/\s+/g, " ").trim();
    const matricula = m[2];
    const palavras = nome.split(" ").filter(Boolean);
    if (palavras.length >= 2 && palavras.length <= 8 && !vistos.has(matricula)) {
      resultado.push({ nome, matricula });
      vistos.add(matricula);
    }
  }
  if (resultado.length > 0) return resultado;

  // Último recurso: uma linha por aluno (PDFs mais simples, com quebra de
  // linha real preservada) — procura o primeiro número de 4+ dígitos da
  // linha e usa o resto como nome.
  const linhas = textoOriginal.split("\n").map((l) => l.trim()).filter(Boolean);
  const regexMatricula = /\b(\d{4,})\b/;
  vistos = new Set();
  for (const linha of linhas) {
    const mm = linha.match(regexMatricula);
    if (!mm) continue;
    const matricula = mm[1];
    if (vistos.has(matricula)) continue;
    const nome = linha
      .replace(mm[0], "")
      .replace(/[-–—:.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (nome.length >= 3 && /[A-Za-zÀ-ÿ]/.test(nome)) {
      resultado.push({ nome, matricula });
      vistos.add(matricula);
    }
  }
  return resultado;
}

function GestaoTurmasView({ perfil, turmas, salvarTurmas, recarregarTurmas, usuarios, empresas, recarregarUsuarios, registrarAuditoria }) {
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [turmaExpandida, setTurmaExpandida] = useState(null);
  const [novoAlunoNome, setNovoAlunoNome] = useState("");
  const [novoAlunoMatricula, setNovoAlunoMatricula] = useState("");
  const [editandoAlunoMatricula, setEditandoAlunoMatricula] = useState(null);
  const [edicaoAlunoNome, setEdicaoAlunoNome] = useState("");
  const [edicaoAlunoMatricula, setEdicaoAlunoMatricula] = useState("");
  const [importando, setImportando] = useState(false);
  const [erroImportacao, setErroImportacao] = useState("");
  const [preVisualizacao, setPreVisualizacao] = useState(null); // { turmaId, alunos: [{nome, matricula}] }
  const podeGerenciar = !!perfil?.permissoes?.gerenciarTurmas;
  const souAluno = perfil?.tipo === "Aluno";
  const souMestre = perfil?.tipo === "Mestre";
  const turmasVisiveis = souAluno ? (turmas || []).filter((t) => t.id === perfil?.turmaId) : turmas || [];

  const criar = async () => {
    if (!novoNome.trim()) return;
    const nova = { id: uid("t"), nome: novoNome.trim(), alunosEsperados: [], criadoEm: Date.now() };
    await salvarTurmas([...(turmas || []), nova]);
    await registrarAuditoria("criar", "turma", `Criou a turma "${nova.nome}"`);
    setNovoNome("");
  };

  const salvarEdicao = async (id) => {
    if (!nomeEdicao.trim()) return;
    const antiga = (turmas || []).find((t) => t.id === id);
    await salvarTurmas((turmas || []).map((t) => (t.id === id ? { ...t, nome: nomeEdicao.trim() } : t)));
    await registrarAuditoria("editar", "turma", `Renomeou a turma "${antiga?.nome}" para "${nomeEdicao.trim()}"`);
    setEditandoId(null);
  };

  const handleArquivoPdf = async (turma, arquivo) => {
    if (!arquivo) return;
    setErroImportacao("");
    setImportando(true);
    try {
      const texto = await extrairTextoPdf(arquivo);
      const alunos = parsearAlunosDoTexto(texto);
      if (alunos.length === 0) {
        setErroImportacao(
          'Não conseguimos identificar nome + matrícula automaticamente neste PDF. Confira se o arquivo tem uma linha por aluno (nome e matrícula juntos), ou cadastre manualmente acima.'
        );
        setImportando(false);
        return;
      }
      setPreVisualizacao({ turmaId: turma.id, alunos });
    } catch {
      setErroImportacao("Não foi possível ler esse PDF. Tente novamente, ou cadastre os alunos manualmente.");
    } finally {
      setImportando(false);
    }
  };

  const removerDaPrevia = (matricula) => {
    setPreVisualizacao((p) => (p ? { ...p, alunos: p.alunos.filter((a) => a.matricula !== matricula) } : p));
  };

  const cancelarPrevia = () => {
    setPreVisualizacao(null);
    setErroImportacao("");
  };

  const confirmarImportacao = async () => {
    const turma = (turmas || []).find((t) => t.id === preVisualizacao.turmaId);
    if (!turma) return;
    const matriculasExistentes = new Set((turmas || []).flatMap((t) => (t.alunosEsperados || []).map((a) => a.matricula)));
    const novos = preVisualizacao.alunos.filter((a) => !matriculasExistentes.has(a.matricula));
    const duplicados = preVisualizacao.alunos.length - novos.length;
    await salvarTurmas(
      (turmas || []).map((t) =>
        t.id === turma.id ? { ...t, alunosEsperados: [...(t.alunosEsperados || []), ...novos] } : t
      )
    );
    await registrarAuditoria(
      "editar",
      "turma",
      `Importou ${novos.length} aluno(s) via PDF na turma "${turma.nome}"${duplicados ? ` (${duplicados} matrícula(s) já existente(s) ignorada(s))` : ""}`
    );
    setPreVisualizacao(null);
  };

  const adicionarAlunoEsperado = async (turma) => {
    if (!novoAlunoNome.trim() || !novoAlunoMatricula.trim()) return;
    const mat = novoAlunoMatricula.trim();
    const jaExiste = (turmas || []).some((t) => (t.alunosEsperados || []).some((a) => a.matricula === mat));
    if (jaExiste) {
      alert("Essa matrícula já está cadastrada em alguma turma.");
      return;
    }
    const registro = { nome: novoAlunoNome.trim(), matricula: mat };
    await salvarTurmas(
      (turmas || []).map((t) =>
        t.id === turma.id ? { ...t, alunosEsperados: [...(t.alunosEsperados || []), registro] } : t
      )
    );
    await registrarAuditoria("editar", "turma", `Adicionou aluno esperado "${registro.nome}" (matrícula ${mat}) na turma "${turma.nome}"`);
    setNovoAlunoNome("");
    setNovoAlunoMatricula("");
  };

  const removerAlunoEsperado = async (turma, registro) => {
    if (!confirm(`Remover "${registro.nome}" (matrícula ${registro.matricula}) da lista da turma "${turma.nome}"?`)) return;
    await salvarTurmas(
      (turmas || []).map((t) =>
        t.id === turma.id
          ? { ...t, alunosEsperados: (t.alunosEsperados || []).filter((a) => a.matricula !== registro.matricula) }
          : t
      )
    );
    await registrarAuditoria("editar", "turma", `Removeu aluno esperado "${registro.nome}" da turma "${turma.nome}"`);
  };

  const iniciarEdicaoAluno = (registro) => {
    setEditandoAlunoMatricula(registro.matricula);
    setEdicaoAlunoNome(registro.nome);
    setEdicaoAlunoMatricula(registro.matricula);
  };

  const salvarEdicaoAluno = async (turma, matriculaOriginal) => {
    const novoNomeAluno = edicaoAlunoNome.trim();
    const novaMatricula = edicaoAlunoMatricula.trim();
    if (!novoNomeAluno || !novaMatricula) return;
    if (
      novaMatricula !== matriculaOriginal &&
      (turmas || []).some((t) => (t.alunosEsperados || []).some((a) => a.matricula === novaMatricula))
    ) {
      alert("Essa matrícula já está cadastrada em alguma turma.");
      return;
    }
    await salvarTurmas(
      (turmas || []).map((t) =>
        t.id === turma.id
          ? {
              ...t,
              alunosEsperados: (t.alunosEsperados || []).map((a) =>
                a.matricula === matriculaOriginal ? { nome: novoNomeAluno, matricula: novaMatricula } : a
              ),
            }
          : t
      )
    );
    await registrarAuditoria(
      "editar",
      "turma",
      `Editou aluno esperado na turma "${turma.nome}": "${novoNomeAluno}" (matrícula ${novaMatricula})`
    );
    setEditandoAlunoMatricula(null);
  };

  const excluir = async (turma) => {
    const emUso = (usuarios || []).filter((u) => u.turmaId === turma.id);
    if (emUso.length) {
      alert(
        `Não é possível excluir esta turma: ${emUso.length} usuário(s) ainda estão vinculados a ela. Mude a turma desses usuários primeiro (no módulo Usuários), ou use a Zona de Perigo abaixo (só Mestre) para excluir e desvincular tudo de uma vez.`
      );
      return;
    }
    if (!confirm(`Excluir a turma "${turma.nome}"? Essa ação não pode ser desfeita.`)) return;
    await salvarTurmas((turmas || []).filter((t) => t.id !== turma.id));
    await registrarAuditoria("excluir", "turma", `Excluiu a turma "${turma.nome}"`);
  };

  // Zona de perigo (só Mestre): exclui a turma e desvincula todos os usuários
  // dela de uma vez (eles continuam existindo, só ficam sem turma vinculada —
  // nenhuma conta é apagada, para não travar o login de ninguém).
  const excluirComCascata = async (turma) => {
    const vinculados = (usuarios || []).filter((u) => u.turmaId === turma.id);
    const digitado = prompt(
      `Isso vai excluir a turma "${turma.nome}" e desvincular ${vinculados.length} usuário(s) dela (eles continuam existindo, só ficam sem turma). Para confirmar, digite o nome EXATO da turma:`
    );
    if (digitado === null) return;
    if (digitado.trim() !== turma.nome) {
      alert("O nome digitado não confere com o nome da turma. Nada foi excluído.");
      return;
    }
    await Promise.all(vinculados.map((u) => atualizarUsuario(u.uid, { turmaId: null })));
    await salvarTurmas((turmas || []).filter((t) => t.id !== turma.id));
    await registrarAuditoria(
      "excluir",
      "turma",
      `Excluiu a turma "${turma.nome}" em cascata, desvinculando ${vinculados.length} usuário(s)`
    );
    recarregarUsuarios();
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Turmas</h2>
      <p className="text-sm text-inkSoft mb-4">
        Cadastre a turma e, para cada aluno, o nome e a matrícula em "Alunos esperados" — é essa matrícula que o
        aluno digita no primeiro login com o Google, para entrar já vinculado (e já aprovado) na turma certa.
      </p>

      {podeGerenciar && (
        <Card className="mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <TxtInput
              placeholder="Nome da turma (ex.: 3ª Contabilidade — Manhã)"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
            />
            <Botao onClick={criar}>
              <Plus size={16} /> Adicionar
            </Botao>
          </div>
        </Card>
      )}

      {!podeGerenciar && (
        <div className="text-sm text-inkSoft mb-4">
          {souAluno
            ? "Você está vendo apenas a sua turma. Só um usuário Mestre ou Professor pode cadastrar, editar ou excluir turmas."
            : <>Você não tem permissão para cadastrar, editar ou excluir turmas. Peça a um usuário <b>Mestre</b> ou{" "}
          <b>Professor</b>.</>}
        </div>
      )}

      <div className="space-y-2">
        {turmasVisiveis.map((t) => {
          const vinculados = (usuarios || []).filter((u) => u.turmaId === t.id).length;
          const expandida = turmaExpandida === t.id;
          return (
            <Card key={t.id}>
              <div className="flex items-center justify-between gap-3">
                {editandoId === t.id ? (
                  <div className="flex-1 flex gap-2">
                    <TxtInput value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} />
                    <Botao onClick={() => salvarEdicao(t.id)}>Salvar</Botao>
                    <Botao variant="ghost" onClick={() => setEditandoId(null)}>
                      Cancelar
                    </Botao>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="font-semibold text-ink text-sm">{t.nome}</div>
                      <div className="text-xs text-inkSoft">
                        {vinculados} usuário(s) vinculado(s) · {(t.alunosEsperados || []).length} matrícula(s) cadastrada(s)
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {podeGerenciar && (
                        <button
                          onClick={() => setTurmaExpandida(expandida ? null : t.id)}
                          className="text-xs text-green underline decoration-dotted hover:opacity-70"
                        >
                          {expandida ? "Fechar" : "Alunos esperados"}
                        </button>
                      )}
                      {souMestre && vinculados > 0 && (
                        <button
                          onClick={() => excluirComCascata(t)}
                          className="text-xs text-red underline decoration-dotted hover:opacity-70"
                          title="Zona de perigo: excluir e desvincular usuários"
                        >
                          Excluir e desvincular
                        </button>
                      )}
                      {podeGerenciar && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setEditandoId(t.id);
                              setNomeEdicao(t.nome);
                            }}
                            className="text-inkSoft hover:text-ink"
                            title="Renomear"
                          >
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => excluir(t)} className="text-red hover:opacity-70" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {expandida && podeGerenciar && (
                <div className="mt-4 pt-4 border-t border-line">
                  <div className="text-xs text-inkSoft uppercase tracking-wide mb-2">
                    Alunos esperados (nome + matrícula)
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <TxtInput placeholder="Nome completo" value={novoAlunoNome} onChange={(e) => setNovoAlunoNome(e.target.value)} />
                    <TxtInput placeholder="Matrícula (ex.: 2024001)" value={novoAlunoMatricula} onChange={(e) => setNovoAlunoMatricula(e.target.value)} />
                    <Botao onClick={() => adicionarAlunoEsperado(t)}>
                      <Plus size={16} /> Adicionar
                    </Botao>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm text-green font-semibold cursor-pointer mb-3 hover:opacity-80">
                    <Upload size={15} />
                    {importando ? "Lendo PDF…" : "Importar lista (PDF)"}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={importando}
                      onChange={(e) => {
                        const arquivo = e.target.files?.[0];
                        e.target.value = "";
                        if (arquivo) handleArquivoPdf(t, arquivo);
                      }}
                    />
                  </label>
                  {erroImportacao && (
                    <div className="text-sm text-red bg-red/10 border border-red/30 rounded-lg p-3 mb-3">{erroImportacao}</div>
                  )}

                  {preVisualizacao && preVisualizacao.turmaId === t.id && (
                    <Card className="mb-3 bg-paper">
                      <div className="text-sm font-semibold text-ink mb-1">
                        Pré-visualização — {preVisualizacao.alunos.length} aluno(s) encontrado(s)
                      </div>
                      <p className="text-xs text-inkSoft mb-2">
                        Confira antes de importar — remova quem estiver errado. Matrículas repetidas ou já
                        cadastradas em outra turma são ignoradas automaticamente.
                      </p>
                      <div className="space-y-1 max-h-60 overflow-y-auto mb-3">
                        {preVisualizacao.alunos.map((a) => (
                          <div key={a.matricula} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-1.5">
                            <span>
                              {a.nome} <span className="text-inkSoft font-mono text-xs">— {a.matricula}</span>
                            </span>
                            <button onClick={() => removerDaPrevia(a.matricula)} className="text-red hover:opacity-70" title="Remover da lista">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Botao onClick={confirmarImportacao}>Importar {preVisualizacao.alunos.length} aluno(s)</Botao>
                        <Botao variant="ghost" onClick={cancelarPrevia}>Cancelar</Botao>
                      </div>
                    </Card>
                  )}

                  {(t.alunosEsperados || []).length === 0 ? (
                    <div className="text-sm text-inkSoft italic">Nenhum aluno esperado cadastrado ainda.</div>
                  ) : (
                    <div className="space-y-1">
                      {(t.alunosEsperados || []).map((a) => {
                        const usuarioVinculado = (usuarios || []).find((u) => u.matricula === a.matricula);
                        const jaAcessou = !!usuarioVinculado;
                        const empresaCriada = usuarioVinculado
                          ? (empresas || []).some((em) => em.alunoId === usuarioVinculado.uid)
                          : false;
                        const editando = editandoAlunoMatricula === a.matricula;
                        return (
                          <div key={a.matricula} className="bg-paper rounded-lg px-3 py-1.5">
                            {editando ? (
                              <div className="flex flex-col sm:flex-row gap-2">
                                <TxtInput value={edicaoAlunoNome} onChange={(e) => setEdicaoAlunoNome(e.target.value)} placeholder="Nome completo" />
                                <TxtInput value={edicaoAlunoMatricula} onChange={(e) => setEdicaoAlunoMatricula(e.target.value)} placeholder="Matrícula" />
                                <div className="flex gap-2 shrink-0">
                                  <Botao onClick={() => salvarEdicaoAluno(t, a.matricula)}>Salvar</Botao>
                                  <Botao variant="ghost" onClick={() => setEditandoAlunoMatricula(null)}>Cancelar</Botao>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-sm">
                                  {a.nome} <span className="text-inkSoft font-mono text-xs">— {a.matricula}</span>
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Pill tone={jaAcessou ? "green" : "default"}>{jaAcessou ? "Já acessou" : "Ainda não acessou"}</Pill>
                                  <Pill tone={empresaCriada ? "green" : "default"}>{empresaCriada ? "Empresa criada" : "Sem empresa"}</Pill>
                                  <button onClick={() => iniciarEdicaoAluno(a)} className="text-inkSoft hover:text-ink" title="Editar">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={() => removerAlunoEsperado(t, a)} className="text-red hover:opacity-70" title="Remover">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {turmas && turmasVisiveis.length === 0 && (
          <div className="text-sm text-inkSoft italic">Nenhuma turma cadastrada ainda.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GESTÃO — EMPRESAS
// ============================================================================

function GestaoEmpresasView({ perfil, empresas, salvarEmpresas, usuarios, registrarAuditoria }) {
  const podeExcluir = !!perfil?.permissoes?.excluirEmpresas;
  const podeGerenciar = !!perfil?.permissoes?.gerenciarTurmas; // mesma permissão usada em Turmas
  const souAluno = perfil?.tipo === "Aluno";

  const formVazio = () => ({ nome: "", cnpj: "", atividade: "", responsavel: "", alunoId: "" });
  const [form, setForm] = useState(formVazio());
  const [editandoId, setEditandoId] = useState(null);

  const alunosAprovados = (usuarios || [])
    .filter((u) => u.tipo === "Aluno" && u.aprovado)
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const alunoNome = (id) => (usuarios || []).find((u) => u.uid === id)?.nome || null;

  const empresasVisiveis = souAluno ? (empresas || []).filter((em) => em.alunoId === perfil?.uid) : empresas || [];

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const dados = { ...form, alunoId: form.alunoId || null };
    if (editandoId) {
      await salvarEmpresas((empresas || []).map((em) => (em.id === editandoId ? { ...em, ...dados } : em)));
      await registrarAuditoria("editar", "empresa", `Editou a empresa "${dados.nome}"`);
    } else {
      await salvarEmpresas([...(empresas || []), { id: uid("e"), ...dados }]);
      await registrarAuditoria("criar", "empresa", `Criou a empresa "${dados.nome}"${dados.alunoId ? ` (vinculada a ${alunoNome(dados.alunoId)})` : ""}`);
    }
    setForm(formVazio());
    setEditandoId(null);
  };

  const editar = (em) => {
    setEditandoId(em.id);
    setForm({
      nome: em.nome,
      cnpj: em.cnpj || "",
      atividade: em.atividade || "",
      responsavel: em.responsavel || "",
      alunoId: em.alunoId || "",
    });
  };

  const excluir = async (em) => {
    if (!podeExcluir) {
      alert("Você não tem permissão para excluir empresas.");
      return;
    }
    if (!confirm(`Excluir a empresa "${em.nome}"? Esta ação não pode ser desfeita.`)) return;
    await salvarEmpresas((empresas || []).filter((x) => x.id !== em.id));
    await registrarAuditoria("excluir", "empresa", `Excluiu a empresa "${em.nome}"`);
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Empresas</h2>
      <p className="text-sm text-inkSoft mb-4">
        {souAluno
          ? "A empresa fictícia usada nos seus lançamentos e demonstrativos."
          : "Empresas fictícias usadas nos lançamentos e demonstrativos — cadastradas pelo professor(a), uma para cada aluno."}
      </p>

      {podeGerenciar && (
        <Card className="mb-4">
          <form onSubmit={salvar} className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome da empresa">
              <TxtInput required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </Field>
            <Field label="CNPJ (fictício)">
              <div className="flex gap-2">
                <TxtInput
                  placeholder="00.000.000/0001-00"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                />
                <Botao type="button" variant="ghost" onClick={() => setForm({ ...form, cnpj: gerarCNPJFicticio() })}>
                  Gerar
                </Botao>
              </div>
            </Field>
            <Field label="Atividade">
              <TxtInput value={form.atividade} onChange={(e) => setForm({ ...form, atividade: e.target.value })} />
            </Field>
            <Field label="Responsável (texto livre, opcional)">
              <TxtInput value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </Field>
            <Field
              label="Aluno responsável"
              hint="Só o aluno vinculado aqui (e os usuários Mestre/Professor) vê esta empresa."
            >
              <SelectInput value={form.alunoId} onChange={(e) => setForm({ ...form, alunoId: e.target.value })}>
                <option value="">— Nenhum (ainda) —</option>
                {alunosAprovados.map((a) => (
                  <option key={a.uid} value={a.uid}>
                    {a.nome}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="sm:col-span-2 flex gap-2">
              <Botao type="submit">{editandoId ? "Salvar alterações" : "Adicionar empresa"}</Botao>
              {editandoId && (
                <Botao
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditandoId(null);
                    setForm(formVazio());
                  }}
                >
                  Cancelar
                </Botao>
              )}
            </div>
          </form>
        </Card>
      )}

      {!podeGerenciar && !souAluno && (
        <div className="text-sm text-inkSoft mb-4">
          Você não tem permissão para cadastrar, editar ou excluir empresas. Peça a um usuário <b>Mestre</b> ou{" "}
          <b>Professor</b>.
        </div>
      )}

      <div className="space-y-2">
        {empresasVisiveis.map((em) => (
          <Card key={em.id} className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-ink text-sm">{em.nome}</div>
              <div className="text-xs text-inkSoft">
                {em.cnpj || "CNPJ não informado"} · {em.atividade || "—"}
              </div>
              {em.responsavel && <div className="text-xs text-inkSoft">Responsável: {em.responsavel}</div>}
              {!souAluno && (
                <div className="text-xs text-inkSoft">
                  Aluno: {alunoNome(em.alunoId) || <span className="italic">— ainda não vinculado —</span>}
                </div>
              )}
            </div>
            {podeGerenciar && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => editar(em)} className="text-inkSoft hover:text-ink" title="Editar">
                  <Pencil size={16} />
                </button>
                {podeExcluir && (
                  <button onClick={() => excluir(em)} className="text-red hover:opacity-70" title="Excluir">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          </Card>
        ))}
        {empresas && empresasVisiveis.length === 0 && (
          <div className="text-sm text-inkSoft italic">
            {souAluno ? "Nenhuma empresa vinculada a você ainda — peça ao professor(a)." : "Nenhuma empresa cadastrada ainda."}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CICLO CONTÁBIL (Fase 2) — Plano de Contas, Saldos Iniciais, Lançamentos e
// Consulta por Conta. Os três últimos trabalham sempre "dentro" de uma
// empresa ativa, escolhida no seletor abaixo (SeletorEmpresaAtiva).
// ============================================================================

const TIPOS_OPERACAO = ["Compra", "Venda"];
const SUGESTAO_HISTORICO = {
  Compra: "Compra de mercadorias/produtos",
  Venda: "Venda de mercadorias/produtos",
};

function SeletorEmpresaAtiva({ empresas, empresaAtivaId, setEmpresaAtivaId }) {
  return (
    <Card className="mb-4">
      <Field
        label="Empresa ativa"
        hint="Os módulos de Saldos, Lançamentos e Consulta por Conta trabalham sempre com os dados desta empresa."
      >
        <SelectInput value={empresaAtivaId || ""} onChange={(e) => setEmpresaAtivaId(e.target.value || null)}>
          <option value="">— Selecione uma empresa —</option>
          {(empresas || []).map((em) => (
            <option key={em.id} value={em.id}>
              {em.nome}
            </option>
          ))}
        </SelectInput>
      </Field>
    </Card>
  );
}

// Campo de conta com busca por código ou nome (em vez de rolar uma lista com
// 292 itens). Mantém a mesma "forma" de evento (onChange recebe {target:{value}})
// para funcionar como substituto direto de um <select> nos formulários.
function ContaSelect({ value, onChange, leaves, contaByCode }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    function aoClicarFora(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAberto(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const contaSelecionada = contaByCode[value];
  const rotuloSelecionado = contaSelecionada ? `${contaSelecionada.codigo} — ${contaSelecionada.nome}` : "";

  const termo = busca.trim().toLowerCase();
  const byGrupo = {};
  leaves.forEach((c) => {
    if (termo && !c.codigo.toLowerCase().includes(termo) && !c.nome.toLowerCase().includes(termo)) return;
    (byGrupo[c.grupo] = byGrupo[c.grupo] || []).push(c);
  });
  const gruposComResultado = GRUPOS.filter((g) => byGrupo[g]);

  const escolher = (codigo) => {
    onChange({ target: { value: codigo } });
    setAberto(false);
    setBusca("");
  };

  return (
    <div className="relative" ref={wrapRef}>
      <TxtInput
        placeholder="Buscar por código ou nome..."
        value={aberto ? busca : rotuloSelecionado}
        onChange={(e) => setBusca(e.target.value)}
        onFocus={() => {
          setAberto(true);
          setBusca("");
        }}
        autoComplete="off"
      />
      {aberto && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-paperRaised border border-line rounded-lg shadow-soft">
          {gruposComResultado.length === 0 && (
            <div className="px-3 py-2 text-sm text-inkSoft italic">Nenhuma conta encontrada.</div>
          )}
          {gruposComResultado.map((g) => (
            <div key={g}>
              <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-inkSoft bg-paper sticky top-0">
                {g}
              </div>
              {byGrupo[g].map((c) => (
                <button
                  type="button"
                  key={c.codigo}
                  onClick={() => escolher(c.codigo)}
                  className={
                    "w-full text-left px-3 py-1.5 text-sm hover:bg-green/10 " +
                    (c.codigo === value ? "bg-green/10 font-semibold text-ink" : "text-ink")
                  }
                >
                  <span className="font-mono text-xs text-inkSoft mr-2">{c.codigo}</span>
                  {c.nome}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PillNatureza({ natureza }) {
  const tone = natureza === "Devedora" ? "green" : natureza === "Credora" ? "gold" : "red";
  return <Pill tone={tone}>{natureza}</Pill>;
}

// ---- Plano de Contas (editável pelo Mestre — com histórico de alterações) ----

function nivelDoCodigo(codigo) {
  return codigo.split(".").length;
}

function tipoSugerido(nivel) {
  return { 1: "Grupo", 2: "Subgrupo", 3: "Conta Sintética", 4: "Conta Analítica", 5: "Subconta Analítica" }[nivel] || "Conta Analítica";
}

function grupoDigitoBase(grupo) {
  const mapa = {
    Ativo: "1", Passivo: "2", "Patrimônio Líquido": "3", Receitas: "4",
    Despesas: "5", Custos: "6", Resultado: "7", "Contas de Compensação": "8",
  };
  return mapa[grupo] || "9";
}

// Sugere o próximo código disponível dentro do Grupo + Tipo escolhidos, seguindo
// a mesma sequência das contas já existentes (incrementa o último segmento do
// maior código encontrado). Sem nenhuma conta desse Tipo no Grupo, tenta usar a
// conta de nível mais raso do Grupo como "pai" (código.01); sem nenhuma conta no
// Grupo ainda, parte do dígito-base do Grupo (Ativo=1, Passivo=2, ...).
function sugerirProximoCodigo(contas, grupo, tipo) {
  const candidatas = contas.filter((c) => c.grupo === grupo && c.tipo === tipo);
  if (candidatas.length > 0) {
    const maior = candidatas
      .slice()
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
      .pop();
    const partes = maior.codigo.split(".");
    const ultimoStr = partes[partes.length - 1];
    const novoUltimo = String((parseInt(ultimoStr, 10) || 0) + 1).padStart(ultimoStr.length, "0");
    partes[partes.length - 1] = novoUltimo;
    return partes.join(".");
  }
  const doGrupo = contas.filter((c) => c.grupo === grupo);
  if (doGrupo.length > 0) {
    const maisRasa = doGrupo.slice().sort((a, b) => a.nivel - b.nivel)[0];
    return `${maisRasa.codigo}.01`;
  }
  return `${grupoDigitoBase(grupo)}.1`;
}

function GestaoPlanoContasView({
  perfil,
  contas,
  salvarPlanoContas,
  auditoria,
  registrarAuditoria,
  empresas,
  notas,
  salvarNotas,
  turmas,
  usuarios,
  prazosAtividades,
  salvarPrazosAtividades,
  liberacoesExcecao,
  salvarLiberacoesExcecao,
}) {
  const podeEditar = perfil?.tipo === "Mestre";
  const [filtro, setFiltro] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoCodigo, setEditandoCodigo] = useState(null); // código não muda numa edição
  const [erro, setErro] = useState("");
  const [colapsados, setColapsados] = useState(new Set());

  const formVazio = () => ({
    codigo: "",
    nome: "",
    grupo: GRUPOS[0],
    tipo: "Conta Analítica",
    natureza: "Devedora",
    aceitaLancamento: true,
    controlaEstoque: false,
  });
  const [form, setForm] = useState(formVazio());
  const [sugestaoAtual, setSugestaoAtual] = useState("");

  // Sugere automaticamente o próximo código disponível quando o professor troca
  // Grupo/Tipo numa conta NOVA — mas nunca sobrescreve um código já digitado à
  // mão (só substitui se o campo estiver vazio ou ainda for a última sugestão).
  useEffect(() => {
    if (!mostrarForm || editandoCodigo) return;
    const sugestao = sugerirProximoCodigo(contas, form.grupo, form.tipo);
    if (!form.codigo || form.codigo === sugestaoAtual) {
      setForm((f) => ({ ...f, codigo: sugestao }));
    }
    setSugestaoAtual(sugestao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.grupo, form.tipo, mostrarForm, editandoCodigo]);

  const linhas = contas.filter((c) => {
    if (!filtro) return true;
    const f = filtro.toLowerCase();
    return c.codigo.toLowerCase().includes(f) || c.nome.toLowerCase().includes(f);
  });

  // Expandir/recolher grupos — colapsados guarda os códigos "fechados"; uma
  // conta fica escondida se qualquer um dos seus ancestrais (grupo/subgrupo)
  // estiver colapsado. Busca ativa ignora o recolhimento (mostra tudo que bate).
  const temFilhos = (codigo) => contas.some((x) => x.codigo !== codigo && x.codigo.startsWith(codigo + "."));
  const estaVisivel = (codigo) => {
    if (filtro) return true;
    const partes = codigo.split(".");
    for (let i = 1; i < partes.length; i++) {
      if (colapsados.has(partes.slice(0, i).join("."))) return false;
    }
    return true;
  };
  const alternarColapso = (codigo) => {
    setColapsados((atual) => {
      const novo = new Set(atual);
      if (novo.has(codigo)) novo.delete(codigo);
      else novo.add(codigo);
      return novo;
    });
  };
  const recolherTudo = () => setColapsados(new Set(contas.filter((c) => temFilhos(c.codigo)).map((c) => c.codigo)));
  const expandirTudo = () => setColapsados(new Set());
  const linhasVisiveis = linhas.filter((c) => estaVisivel(c.codigo));

  const iniciarNovo = () => {
    setEditandoCodigo(null);
    setForm(formVazio());
    setErro("");
    setMostrarForm(true);
  };

  const iniciarEdicao = (c) => {
    setEditandoCodigo(c.codigo);
    setForm({
      codigo: c.codigo, nome: c.nome, grupo: c.grupo, tipo: c.tipo, natureza: c.natureza,
      aceitaLancamento: c.aceitaLancamento, controlaEstoque: !!c.controlaEstoque,
    });
    setErro("");
    setMostrarForm(true);
  };

  const cancelar = () => {
    setMostrarForm(false);
    setEditandoCodigo(null);
    setForm(formVazio());
    setErro("");
  };

  const salvar = async (e) => {
    e.preventDefault();
    const codigo = form.codigo.trim();
    if (!codigo || !form.nome.trim()) {
      setErro("Preencha código e nome.");
      return;
    }
    if (!/^[0-9]+(\.[0-9]+)*$/.test(codigo)) {
      setErro('Use o formato de código com números separados por ponto, ex.: "1.1.1.01".');
      return;
    }
    setErro("");

    const nivel = nivelDoCodigo(codigo);
    const dados = {
      codigo,
      nome: form.nome.trim(),
      nivel,
      grupo: form.grupo,
      tipo: form.tipo,
      natureza: form.natureza,
      aceitaLancamento: !!form.aceitaLancamento,
      controlaEstoque: !!form.controlaEstoque,
    };

    if (editandoCodigo) {
      const nova = contas.map((c) => (c.codigo === editandoCodigo ? { ...dados, codigo: editandoCodigo, nivel: nivelDoCodigo(editandoCodigo) } : c));
      await salvarPlanoContas(nova);
      await registrarAuditoria("editar", "conta", `Editou a conta ${editandoCodigo} — ${dados.nome}`);
    } else {
      if (contas.some((c) => c.codigo === codigo)) {
        setErro(`Já existe uma conta com o código "${codigo}".`);
        return;
      }
      const nova = [...contas, dados].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
      await salvarPlanoContas(nova);
      await registrarAuditoria("criar", "conta", `Criou a conta ${codigo} — ${dados.nome}`);
    }
    cancelar();
  };

  const excluir = async (c) => {
    if (
      !confirm(
        `Excluir a conta "${c.codigo} — ${c.nome}"?\n\nSe essa conta já foi usada em lançamentos de alguma empresa, esses lançamentos não são apagados, mas passam a exibir apenas o código, sem nome/descrição. Esta ação não pode ser desfeita.`
      )
    )
      return;
    await salvarPlanoContas(contas.filter((x) => x.codigo !== c.codigo));
    await registrarAuditoria("excluir", "conta", `Excluiu a conta ${c.codigo} — ${c.nome}`);
    if (editandoCodigo === c.codigo) cancelar();
  };

  const historico = (auditoria || []).filter((a) => a.entidade === "conta").slice(0, 30);

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Plano de Contas</h2>
      <p className="text-sm text-inkSoft mb-4">
        {contas.length} contas · estrutura completa. Quanto mais números no código, maior o nível
        de detalhamento — lançamentos ocorrem apenas nas contas analíticas ou subcontas. O plano de
        contas é único e compartilhado por todas as empresas cadastradas.
        {!podeEditar && " Somente um usuário Mestre pode incluir, editar ou excluir contas."}
      </p>

      <Card className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <TxtInput
          placeholder="Buscar por código ou nome..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="flex-1"
        />
        <div className="flex gap-2 text-xs shrink-0">
          <button onClick={expandirTudo} className="text-green underline decoration-dotted hover:opacity-70">
            Expandir tudo
          </button>
          <button onClick={recolherTudo} className="text-green underline decoration-dotted hover:opacity-70">
            Recolher tudo
          </button>
        </div>
        {podeEditar && <Botao onClick={iniciarNovo}>
          <Plus size={16} /> Nova conta
        </Botao>}
      </Card>

      {mostrarForm && podeEditar && (
        <Card className="mb-4">
          <h3 className="font-serif font-semibold text-ink mb-3">
            {editandoCodigo ? `Editar conta ${editandoCodigo}` : "Nova conta"}
          </h3>
          <form onSubmit={salvar} className="grid sm:grid-cols-2 gap-3">
            <Field label="Código" hint={editandoCodigo ? "O código não pode ser alterado numa conta já existente." : "Sugerido automaticamente a partir do Grupo e Tipo escolhidos — pode editar se preferir outro número."}>
              <TxtInput
                required
                disabled={!!editandoCodigo}
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ex.: 1.1.1.08"
              />
            </Field>
            <Field label="Nome da conta">
              <TxtInput required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </Field>
            <Field label="Grupo">
              <SelectInput value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })}>
                {GRUPOS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Tipo">
              <SelectInput value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {["Grupo", "Subgrupo", "Conta Sintética", "Conta Analítica", "Subconta Analítica"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Natureza">
              <SelectInput value={form.natureza} onChange={(e) => setForm({ ...form, natureza: e.target.value })}>
                {["Devedora", "Credora", "Variável", "Compensação"].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Recebe lançamentos?">
              <label className="flex items-center gap-2 text-sm text-ink mt-2">
                <input
                  type="checkbox"
                  checked={form.aceitaLancamento}
                  onChange={(e) => setForm({ ...form, aceitaLancamento: e.target.checked })}
                />
                Sim, esta conta pode receber lançamentos diretamente
              </label>
            </Field>
            <Field
              label="Controla estoque (PEPS/UEPS/MP)?"
              hint="Marque só em contas de mercadoria/produto físico — habilita o campo Quantidade nos Lançamentos e alimenta o Controle de Estoque automaticamente."
            >
              <label className="flex items-center gap-2 text-sm text-ink mt-2">
                <input
                  type="checkbox"
                  checked={form.controlaEstoque}
                  onChange={(e) => setForm({ ...form, controlaEstoque: e.target.checked })}
                />
                Sim, esta conta representa um item físico de estoque
              </label>
            </Field>
            {erro && <div className="sm:col-span-2 text-sm text-red">{erro}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <Botao type="submit">{editandoCodigo ? "Salvar alterações" : "Adicionar conta"}</Botao>
              <Botao type="button" variant="ghost" onClick={cancelar}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Código</th>
              <th className="py-2 pr-3">Conta</th>
              <th className="py-2 pr-3">Nível</th>
              <th className="py-2 pr-3">Grupo</th>
              <th className="py-2 pr-3">Natureza</th>
              <th className="py-2 pr-3">Lanç.?</th>
              <th className="py-2 pr-3">Estoque?</th>
              {podeEditar && <th className="py-2 pr-3"></th>}
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((c) => (
              <tr
                key={c.codigo}
                className={"border-b border-line/50 " + (c.nivel <= 2 ? "font-semibold" : "")}
              >
                <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{c.codigo}</td>
                <td className="py-1.5 pr-3" style={{ paddingLeft: (c.nivel - 1) * 14 }}>
                  <span className="inline-flex items-center gap-1">
                    {temFilhos(c.codigo) ? (
                      <button
                        onClick={() => alternarColapso(c.codigo)}
                        className="text-inkSoft hover:text-ink shrink-0"
                        title={colapsados.has(c.codigo) ? "Expandir" : "Recolher"}
                      >
                        <ChevronRight
                          size={14}
                          className={"transition-transform " + (colapsados.has(c.codigo) ? "" : "rotate-90")}
                        />
                      </button>
                    ) : (
                      <span className="inline-block w-[14px]" />
                    )}
                    {c.nome}
                  </span>
                </td>
                <td className="py-1.5 pr-3">{c.nivel}</td>
                <td className="py-1.5 pr-3">{c.grupo}</td>
                <td className="py-1.5 pr-3">
                  <PillNatureza natureza={c.natureza} />
                </td>
                <td className="py-1.5 pr-3">{c.aceitaLancamento ? <Pill tone="green">Sim</Pill> : "—"}</td>
                <td className="py-1.5 pr-3">{c.controlaEstoque ? <Pill tone="gold">Sim</Pill> : "—"}</td>
                {podeEditar && (
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button onClick={() => iniciarEdicao(c)} className="text-inkSoft hover:text-ink" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => excluir(c)} className="text-red hover:opacity-70" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {linhasVisiveis.length === 0 && (
              <tr>
                <td colSpan={podeEditar ? 8 : 7} className="py-4 text-center text-inkSoft italic">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {podeEditar && historico.length > 0 && (
        <Card className="mt-4">
          <h3 className="font-serif font-semibold text-ink mb-3">Histórico de alterações neste plano de contas</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {historico.map((h) => (
              <div key={h.id} className="text-xs text-inkSoft flex flex-wrap gap-x-2">
                <span className="whitespace-nowrap">{fmtDateTime(h.timestamp)}</span>
                <span>—</span>
                <span className="font-semibold text-ink">{h.usuarioNome || "—"}:</span>
                <span>{h.descricao}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <AtividadeAvaliativaV2
        moduloId="plano-contas"
        moduloLabel="Plano de Contas"
        perfil={perfil}
        empresas={empresas}
        notas={notas}
        salvarNotas={salvarNotas}
        registrarAuditoria={registrarAuditoria}
        turmas={turmas}
        usuarios={usuarios}
        prazosAtividades={prazosAtividades}
        salvarPrazosAtividades={salvarPrazosAtividades}
        liberacoesExcecao={liberacoesExcecao}
        salvarLiberacoesExcecao={salvarLiberacoesExcecao}
      />
    </div>
  );
}

// ---- Saldos Iniciais (por empresa ativa) ----

function GestaoSaldosView({ empresa, saldos, salvarSaldos, leaves, registrarAuditoria }) {
  const [filtro, setFiltro] = useState("");
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [rascunho, setRascunho] = useState(saldos || {});

  useEffect(() => {
    setRascunho(saldos || {});
  }, [saldos]);

  if (!empresa) {
    return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima para ver os saldos.</div>;
  }

  // Por padrão, só as contas do "lançamento de abertura" aparecem aqui:
  // Capital Subscrito (Patrimônio Líquido) e suas contrapartidas mais comuns
  // no Ativo — Disponível (Caixa/Bancos) e Imobilizado. As demais contas
  // patrimoniais (Passivo, outras do Ativo etc.) e as de Receita/Custo/Despesa
  // nascem zeradas e são movimentadas normalmente pelos Lançamentos.
  const CODIGOS_ABERTURA = [
    "3.1.01", // Capital Subscrito
    "1.1.1.01", "1.1.1.02.01", "1.1.1.02.02", // Caixa Geral, Banco X, Banco Y
    "1.2.3.01", "1.2.3.02", "1.2.3.03", "1.2.3.05", "1.2.3.07", "1.2.3.08", "1.2.3.09", // Imobilizado
  ];
  const leavesAbertura = leaves.filter((c) => CODIGOS_ABERTURA.includes(c.codigo));
  const baseVisivel = mostrarTodas ? leaves : leavesAbertura;

  const linhas = baseVisivel.filter((c) => {
    if (!filtro) return true;
    const f = filtro.toLowerCase();
    return c.codigo.toLowerCase().includes(f) || c.nome.toLowerCase().includes(f);
  });

  const totDev = leaves.reduce((s, c) => s + Number((rascunho[c.codigo] || {}).devedor || 0), 0);
  const totCred = leaves.reduce((s, c) => s + Number((rascunho[c.codigo] || {}).credor || 0), 0);
  const bateOk = Math.abs(totDev - totCred) < 0.005;

  const mudar = (codigo, lado, valor) => {
    setRascunho((r) => ({
      ...r,
      [codigo]: { ...(r[codigo] || { devedor: 0, credor: 0 }), [lado]: valor === "" ? 0 : Number(valor) },
    }));
  };

  const salvar = async () => {
    await salvarSaldos(rascunho);
    await registrarAuditoria("editar", "saldoInicial", `Atualizou os saldos iniciais da empresa "${empresa.nome}"`);
    alert("Saldos iniciais salvos.");
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Saldos Iniciais — {empresa.nome}</h2>
      <p className="text-sm text-inkSoft mb-1">
        Registre aqui o <b>lançamento de abertura</b> da empresa: credite o Capital Subscrito pelo
        total investido pelos sócios, e distribua o mesmo valor em débito entre uma ou mais contas
        de Ativo (Caixa, Bancos ou Imobilizado) — o total devedor precisa bater com o total credor.
      </p>
      <p className="text-xs text-inkSoft mb-4">
        {mostrarTodas
          ? "Mostrando todas as contas do plano."
          : "Mostrando só as contas do lançamento de abertura — Capital Subscrito e suas contrapartidas mais comuns no Ativo (Caixa, Bancos, Imobilizado). As demais contas patrimoniais e as de Receita, Custo e Despesa são movimentadas normalmente pelos Lançamentos."}{" "}
        <button onClick={() => setMostrarTodas((v) => !v)} className="text-green underline decoration-dotted hover:opacity-70">
          {mostrarTodas ? "Mostrar só as contas de abertura" : "Mostrar todas as contas"}
        </button>
      </p>

      <Card className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <TxtInput
          placeholder="Buscar por código ou nome..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="flex-1"
        />
        <Botao onClick={salvar}>Salvar saldos iniciais</Botao>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Código</th>
              <th className="py-2 pr-3">Conta</th>
              <th className="py-2 pr-3">Natureza</th>
              <th className="py-2 pr-3 text-right">Saldo Devedor</th>
              <th className="py-2 pr-3 text-right">Saldo Credor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => {
              const cur = rascunho[c.codigo] || {};
              return (
                <tr key={c.codigo} className="border-b border-line/50">
                  <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{c.codigo}</td>
                  <td className="py-1.5 pr-3">{c.nome}</td>
                  <td className="py-1.5 pr-3">
                    <PillNatureza natureza={c.natureza} />
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cur.devedor || ""}
                      onChange={(e) => mudar(c.codigo, "devedor", e.target.value)}
                      className="w-28 text-right border border-line rounded px-2 py-1 text-sm outline-none focus:border-green focus:ring-1 focus:ring-green"
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cur.credor || ""}
                      onChange={(e) => mudar(c.codigo, "credor", e.target.value)}
                      className="w-28 text-right border border-line rounded px-2 py-1 text-sm outline-none focus:border-green focus:ring-1 focus:ring-green"
                    />
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-inkSoft italic">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={3} className="py-2 pr-3">
                TOTAIS
              </td>
              <td className="py-2 pr-3 text-right">{numFmt(totDev)}</td>
              <td className="py-2 pr-3 text-right">{numFmt(totCred)}</td>
            </tr>
            {!bateOk && (
              <tr className="text-red font-semibold">
                <td colSpan={3} className="py-2 pr-3">
                  Diferença
                </td>
                <td colSpan={2} className="py-2 pr-3 text-right">
                  {numFmt(Math.abs(totDev - totCred))}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </Card>

      <div className="text-sm mt-3">
        Verificação: devedores = credores →{" "}
        {bateOk ? (
          <span className="text-green font-semibold">OK</span>
        ) : (
          <span className="text-red font-semibold">DIVERGENTE</span>
        )}
      </div>
    </div>
  );
}

// ---- Lançamentos (Livro Diário — por empresa ativa) ----

// Etapa 1 do módulo: 10 fatos contábeis orientados, apresentados um de cada
// vez (com o enunciado logo acima da tela de lançamento) até o aluno
// completar todos — a partir daí, só fica disponível o lançamento livre
// (Etapa 2), com a mesma tela e lógica de sempre.
const FATOS_ORIENTADOS = [
  "A empresa comprou 100 unidades de mercadorias, pagando à vista em dinheiro (Caixa), a R$ 20,00 cada — total de R$ 2.000,00.",
  "A empresa comprou 50 unidades de mercadorias a prazo do fornecedor, a R$ 25,00 cada — total de R$ 1.250,00, para pagamento futuro.",
  "A empresa vendeu 40 unidades de mercadorias à vista, recebendo R$ 3.000,00 no Banco X.",
  "Registre a baixa do custo das mercadorias vendidas (CMV) referente à venda do fato anterior.",
  "A empresa vendeu 30 unidades de mercadorias a prazo para um cliente, no valor de R$ 2.400,00, para recebimento futuro.",
  "Registre a baixa do custo das mercadorias vendidas (CMV) referente à venda do fato anterior.",
  "A empresa pagou ao fornecedor a duplicata referente à compra do fato 2, através do Banco Y.",
  "A empresa recebeu do cliente a duplicata referente à venda do fato 5, através do Banco X.",
  "A empresa pagou R$ 800,00 de aluguel do mês, através do Banco Y.",
  "A empresa pagou R$ 3.500,00 de salários dos funcionários, através do Banco X.",
];

function GestaoLancamentosView({ empresa, perfil, lancamentos, salvarLancamentos, leaves, contaByCode, registrarAuditoria }) {
  // Aluno sempre pode editar/excluir os lançamentos da PRÓPRIA empresa (é a
  // prática dele) — a permissão "excluirLancamentos" (concedida por um
  // Mestre/Professor) só é necessária para mexer em lançamentos de outras
  // empresas (ex.: Mestre corrigindo o trabalho de um aluno).
  const ehDonoDaEmpresa = perfil?.tipo === "Aluno" && empresa?.alunoId === perfil?.uid;
  const podeExcluir = ehDonoDaEmpresa || !!perfil?.permissoes?.excluirLancamentos;

  const formVazio = () => ({
    data: new Date().toISOString().slice(0, 10),
    tipoOperacao: "",
    historico: "",
    contaDebito: "",
    contaCredito: "",
    valor: "",
    valorUnitario: "",
    documento: "",
    observacoes: "",
    quantidade: "",
  });

  const [form, setForm] = useState(formVazio());
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  // Cursor de navegação do enunciado orientado — permite reler fatos já
  // lançados (seta ◀) sem afetar qual fato será de fato marcado ao salvar
  // (isso é sempre o próximo pendente, calculado abaixo). A seta ▶ nunca
  // ultrapassa o próximo pendente, então não dá pra "pular" um fato.
  const [cursorFato, setCursorFato] = useState(1);

  const lanc = lancamentos || [];

  // Etapa 1 (Lançamentos Orientados): só se aplica ao próprio aluno, na sua
  // empresa, enquanto ele não tiver completado os 10 fatos e não estiver
  // editando um lançamento já existente. Contagem baseada nos lançamentos já
  // marcados com fatoOrientado — se o aluno excluir um deles, o fato
  // correspondente volta a ser apresentado (comportamento esperado).
  const concluidosGuiados = lanc.filter((l) => l.fatoOrientado).length;
  const emEtapaGuiada = ehDonoDaEmpresa && concluidosGuiados < FATOS_ORIENTADOS.length && !editandoId;
  const fatoPendenteNumero = Math.min(concluidosGuiados + 1, FATOS_ORIENTADOS.length);
  const concluiuTodosGuiados = ehDonoDaEmpresa && concluidosGuiados >= FATOS_ORIENTADOS.length;

  // Mantém o cursor de navegação sincronizado com o próximo fato pendente
  // sempre que o progresso mudar (novo lançamento salvo ou um antigo
  // excluído) — sem isso, o aluno teria que clicar em ▶ manualmente toda vez.
  useEffect(() => {
    setCursorFato(fatoPendenteNumero);
  }, [fatoPendenteNumero]);

  const fatoExibidoNumero = Math.min(Math.max(cursorFato, 1), fatoPendenteNumero);
  const fatoExibidoTexto = FATOS_ORIENTADOS[fatoExibidoNumero - 1];
  const fatoExibidoJaLancado = fatoExibidoNumero <= concluidosGuiados;

  if (!empresa) {
    return (
      <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima para lançar.</div>
    );
  }

  const totalPeriodo = lanc.reduce((s, l) => s + Number(l.valor), 0);

  const filtrados = lanc.filter((l) => {
    if (filtroTipo && l.tipoOperacao !== filtroTipo) return false;
    if (filtroTexto) {
      const alvo = `${l.historico} ${l.contaDebito} ${l.contaCredito} ${l.documento || ""} ${l.observacoes || ""}`.toLowerCase();
      if (!alvo.includes(filtroTexto.toLowerCase())) return false;
    }
    return true;
  });

  const editar = (l) => {
    if (!podeExcluir) {
      alert("Você não tem permissão para editar lançamentos.");
      return;
    }
    setEditandoId(l.id);
    setForm({
      data: l.data,
      tipoOperacao: l.tipoOperacao || "",
      historico: l.historico,
      contaDebito: l.contaDebito,
      contaCredito: l.contaCredito,
      valor: l.valor,
      valorUnitario: l.valorUnitario || "",
      documento: l.documento || "",
      observacoes: l.observacoes || "",
      quantidade: l.quantidade || "",
    });
    setErro("");
  };

  const cancelar = () => {
    setEditandoId(null);
    setForm(formVazio());
    setErro("");
  };

  const excluir = async (l) => {
    if (!podeExcluir) {
      alert("Você não tem permissão para excluir lançamentos.");
      return;
    }
    if (!confirm(`Excluir o lançamento "${l.historico}"? Esta ação não pode ser desfeita.`)) return;
    await salvarLancamentos(lanc.filter((x) => x.id !== l.id));
    await registrarAuditoria(
      "excluir",
      "lancamento",
      `Excluiu lançamento na empresa "${empresa.nome}": "${l.historico}" — ${money(l.valor)} (Déb: ${l.contaDebito} / Créd: ${l.contaCredito})`
    );
    if (editandoId === l.id) cancelar();
  };

  const contaDebitoObj = contaByCode[form.contaDebito];
  const contaCreditoObj = contaByCode[form.contaCredito];
  const ehEntradaEstoque = !!contaDebitoObj?.controlaEstoque; // compra — débito na conta de estoque
  const ehSaidaEstoque = !!contaCreditoObj?.controlaEstoque; // venda — crédito na conta de estoque
  const envolveEstoque = ehEntradaEstoque || ehSaidaEstoque;

  const quantidadeNum = Number(form.quantidade) || 0;
  const valorUnitarioNum = Number(form.valorUnitario) || 0;
  const valorTotalCompra = quantidadeNum * valorUnitarioNum;
  // Na venda, o valor total é digitado (é o valor da operação); o unitário
  // mostrado aqui é só referência — não interfere no estoque, porque cada
  // método de custeio (PEPS/UEPS/MP) calcula seu próprio custo unitário a
  // partir da ficha kardex, não do valor de venda.
  const valorUnitarioVendaCalculado =
    ehSaidaEstoque && quantidadeNum > 0 ? (Number(form.valor) || 0) / quantidadeNum : 0;

  const salvar = async (e) => {
    e.preventDefault();
    if (form.contaDebito === form.contaCredito) {
      setErro("A conta de débito e a de crédito não podem ser iguais.");
      return;
    }
    if (!form.contaDebito || !form.contaCredito || !form.historico.trim() || !form.data) {
      setErro("Preencha data, histórico e as duas contas.");
      return;
    }
    if (envolveEstoque && !(quantidadeNum > 0)) {
      setErro("Esta conta controla estoque — informe a Quantidade movimentada (maior que zero).");
      return;
    }
    if (ehEntradaEstoque && !(valorUnitarioNum > 0)) {
      setErro("Informe o Valor unitário da compra (maior que zero).");
      return;
    }
    const valorFinal = ehEntradaEstoque ? valorTotalCompra : Number(form.valor);
    if (!(valorFinal > 0)) {
      setErro("Informe o valor do lançamento.");
      return;
    }
    setErro("");
    const dados = {
      ...form,
      valor: valorFinal,
      tipoOperacao: form.tipoOperacao || undefined,
      quantidade: envolveEstoque ? quantidadeNum : undefined,
      valorUnitario: ehEntradaEstoque ? valorUnitarioNum : undefined,
    };
    if (editandoId) {
      // Não mexe em fatoOrientado — a edição corrige os dados do lançamento,
      // nunca a marcação de qual fato guiado ele pertence (ver comentário
      // acima sobre o bug de progresso "voltando" ao ser editado).
      await salvarLancamentos(lanc.map((l) => (l.id === editandoId ? { ...l, ...dados } : l)));
      await registrarAuditoria(
        "editar",
        "lancamento",
        `Editou lançamento na empresa "${empresa.nome}": "${dados.historico}" — ${money(dados.valor)} (Déb: ${dados.contaDebito} / Créd: ${dados.contaCredito})`
      );
    } else {
      // Novo lançamento: se estiver na etapa guiada, marca sempre com o
      // próximo fato pendente — nunca com o que estiver sendo exibido pelas
      // setas de navegação (essas só servem para reler enunciados).
      const novo = {
        id: uid("l"),
        usuarioId: perfil?.uid,
        ...dados,
        fatoOrientado: emEtapaGuiada ? fatoPendenteNumero : undefined,
      };
      await salvarLancamentos([...lanc, novo]);
      await registrarAuditoria(
        "criar",
        "lancamento",
        `Lançou na empresa "${empresa.nome}": "${dados.historico}" — ${money(dados.valor)} (Déb: ${dados.contaDebito} / Créd: ${dados.contaCredito})`
      );
    }
    cancelar();
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">
        {editandoId
          ? "Editar lançamento"
          : emEtapaGuiada
          ? `Fato contábil ${fatoPendenteNumero} de ${FATOS_ORIENTADOS.length} pendente`
          : "Novo lançamento"}{" "}
        — {empresa.nome}
      </h2>
      <p className="text-sm text-inkSoft mb-4">
        Toda operação exige uma conta a débito e uma conta a crédito, sempre no mesmo valor
        (partidas dobradas).
      </p>

      {emEtapaGuiada && (
        <Card className="mb-4 border-gold/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gold uppercase tracking-wide">
                Fato contábil {String(fatoExibidoNumero).padStart(2, "0")}
              </span>
              {fatoExibidoJaLancado ? (
                <Pill tone="green">Já lançado</Pill>
              ) : (
                <Pill tone="gold">Pendente — responda aqui embaixo</Pill>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCursorFato((n) => Math.max(1, n - 1))}
                disabled={fatoExibidoNumero <= 1}
                className="p-1 rounded border border-line text-inkSoft hover:text-ink hover:border-ink disabled:opacity-30 disabled:hover:text-inkSoft disabled:hover:border-line"
                title="Fato anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-inkSoft w-12 text-center">{fatoExibidoNumero} de {FATOS_ORIENTADOS.length}</span>
              <button
                type="button"
                onClick={() => setCursorFato((n) => Math.min(fatoPendenteNumero, n + 1))}
                disabled={fatoExibidoNumero >= fatoPendenteNumero}
                className="p-1 rounded border border-line text-inkSoft hover:text-ink hover:border-ink disabled:opacity-30 disabled:hover:text-inkSoft disabled:hover:border-line"
                title="Próximo fato"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <p className="text-sm text-ink">{fatoExibidoTexto}</p>
          {fatoExibidoJaLancado && (
            <p className="text-xs text-inkSoft mt-2 italic">
              Você está revendo este fato. O formulário abaixo continua registrando o Fato{" "}
              {fatoPendenteNumero} (o próximo pendente).
            </p>
          )}
        </Card>
      )}

      {concluiuTodosGuiados && !editandoId && (
        <div className="flex items-center gap-2 mb-4 text-sm text-green bg-green/10 border border-green/30 rounded-lg px-3 py-2">
          <ShieldCheck size={16} />
          Você concluiu os {FATOS_ORIENTADOS.length} fatos contábeis orientados. A partir de agora, use
          "Adicionar lançamento" para registrar as operações indicadas pelo professor em sala.
        </div>
      )}

      <Card className="mb-4">
        <form onSubmit={salvar} className="grid sm:grid-cols-2 gap-3">
          <Field label="Data">
            <TxtInput type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </Field>
          <Field label="Tipo de operação (opcional)">
            <SelectInput
              value={form.tipoOperacao}
              onChange={(e) => {
                const tipo = e.target.value;
                setForm((f) => ({
                  ...f,
                  tipoOperacao: tipo,
                  historico: f.historico.trim() ? f.historico : SUGESTAO_HISTORICO[tipo] || "",
                }));
              }}
            >
              <option value="">Selecione (opcional)...</option>
              {TIPOS_OPERACAO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Histórico do fato contábil">
              <TxtInput
                required
                placeholder="Ex.: Venda de mercadorias à vista"
                value={form.historico}
                onChange={(e) => setForm({ ...form, historico: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Conta débito">
            <ContaSelect
              value={form.contaDebito}
              onChange={(e) => setForm({ ...form, contaDebito: e.target.value })}
              leaves={leaves}
              contaByCode={contaByCode}
            />
          </Field>
          <Field label="Conta crédito">
            <ContaSelect
              value={form.contaCredito}
              onChange={(e) => setForm({ ...form, contaCredito: e.target.value })}
              leaves={leaves}
              contaByCode={contaByCode}
            />
          </Field>
          {ehEntradaEstoque && (
            <>
              <Field label="Quantidade" hint={`${contaDebitoObj.nome} controla estoque — quantidade comprada.`}>
                <TxtInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Ex.: 100"
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                />
              </Field>
              <Field label="Valor unitário (R$)" hint="Custo de compra de cada unidade.">
                <TxtInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0,00"
                  value={form.valorUnitario}
                  onChange={(e) => setForm({ ...form, valorUnitario: e.target.value })}
                />
              </Field>
              <Field label="Valor Total (R$) — calculado automaticamente">
                <TxtInput readOnly disabled value={money(valorTotalCompra)} />
              </Field>
            </>
          )}

          {ehSaidaEstoque && (
            <>
              <Field label="Quantidade" hint={`${contaCreditoObj.nome} controla estoque — quantidade vendida/baixada.`}>
                <TxtInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Ex.: 60"
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                />
              </Field>
              <Field
                label="Valor Total (R$)"
                hint="Valor da venda — o custo pelo PEPS/UEPS/MP é calculado à parte, no Controle de Estoque."
              >
                <TxtInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                />
              </Field>
              <Field label="Valor unitário (R$) — referência, calculado automaticamente">
                <TxtInput readOnly disabled value={money(valorUnitarioVendaCalculado)} />
              </Field>
            </>
          )}

          {!envolveEstoque && (
            <Field label="Valor (R$)">
              <TxtInput
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </Field>
          )}
          <Field label="Documento">
            <TxtInput
              placeholder="Ex.: NF 1234"
              value={form.documento}
              onChange={(e) => setForm({ ...form, documento: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações">
              <TxtInput
                placeholder="Informações complementares do lançamento"
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </Field>
          </div>
          {erro && <div className="sm:col-span-2 text-sm text-red">{erro}</div>}
          <div className="sm:col-span-2 flex gap-2">
            <Botao type="submit">{editandoId ? "Salvar alterações" : "Adicionar lançamento"}</Botao>
            {editandoId && (
              <Botao type="button" variant="ghost" onClick={cancelar}>
                Cancelar edição
              </Botao>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-serif font-semibold text-ink">
            Livro Diário <span className="text-inkSoft font-normal text-sm">({lanc.length})</span>
          </h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <TxtInput
            placeholder="Buscar por histórico, conta, documento ou observação..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="flex-1"
          />
          <SelectInput value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="sm:max-w-[180px]">
            <option value="">Todos os tipos</option>
            {TIPOS_OPERACAO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-inkSoft border-b border-line">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Histórico</th>
                <th className="py-2 pr-3">Débito</th>
                <th className="py-2 pr-3">Crédito</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3">Documento</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id} className="border-b border-line/50 align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(l.data)}</td>
                  <td className="py-1.5 pr-3">{l.tipoOperacao ? <Pill tone="gold">{l.tipoOperacao}</Pill> : "—"}</td>
                  <td className="py-1.5 pr-3">
                    {l.fatoOrientado && (
                      <span className="inline-block text-[10px] font-semibold text-gold border border-gold/40 rounded px-1 mr-1.5 align-middle">
                        Fato {l.fatoOrientado}
                      </span>
                    )}
                    {l.historico}
                    {l.observacoes && <div className="text-xs text-inkSoft">{l.observacoes}</div>}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-xs" title={contaByCode[l.contaDebito]?.nome}>
                    {l.contaDebito}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-xs" title={contaByCode[l.contaCredito]?.nome}>
                    {l.contaCredito}
                  </td>
                  <td className="py-1.5 pr-3 text-right whitespace-nowrap">{money(l.valor)}</td>
                  <td className="py-1.5 pr-3">{l.documento}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {podeExcluir && (
                      <div className="flex gap-2">
                        <button onClick={() => editar(l)} className="text-inkSoft hover:text-ink" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => excluir(l)} className="text-red hover:opacity-70" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-inkSoft italic">
                    {lanc.length ? "Nenhum lançamento corresponde à busca." : "Nenhum lançamento registrado ainda para esta empresa."}
                  </td>
                </tr>
              )}
            </tbody>
            {lanc.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={5} className="py-2 pr-3">
                    TOTAL LANÇADO NO PERÍODO
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{money(totalPeriodo)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!podeExcluir && (
          <div className="text-xs text-inkSoft mt-3">
            Você não tem permissão para editar ou excluir lançamentos. Peça a um usuário <b>Mestre</b> ou{" "}
            <b>Professor</b>.
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- Consulta por Conta (Razão — por empresa ativa) ----

function GestaoConsultaView({ empresa, lancamentos, saldos, leaves, contaByCode }) {
  const [codigo, setCodigo] = useState(leaves[0]?.codigo || "");

  if (!empresa) {
    return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima para consultar.</div>;
  }

  const lanc = lancamentos || [];
  const sal = saldos || {};
  const conta = contaByCode[codigo];

  const movs = lanc
    .filter((l) => l.contaDebito === codigo || l.contaCredito === codigo)
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data));

  const ini = conta
    ? conta.natureza === "Credora"
      ? Number((sal[codigo] || {}).credor || 0) - Number((sal[codigo] || {}).devedor || 0)
      : Number((sal[codigo] || {}).devedor || 0) - Number((sal[codigo] || {}).credor || 0)
    : 0;

  let saldoAcumulado = ini;
  const linhas = movs.map((l) => {
    const isDeb = l.contaDebito === codigo;
    const efeito = conta && conta.natureza === "Credora" ? (isDeb ? -1 : 1) : isDeb ? 1 : -1;
    saldoAcumulado += efeito * Number(l.valor);
    return { l, isDeb, saldoAcumulado };
  });

  const s = saldoConta(lanc, sal, contaByCode, codigo);

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Consulta por Conta — {empresa.nome}</h2>
      <p className="text-sm text-inkSoft mb-4">
        Extrato (razão) individual de qualquer conta, com saldo acumulado — como um extrato
        bancário.
      </p>

      <Card className="mb-4 max-w-md">
        <Field label="Conta">
          <ContaSelect value={codigo} onChange={(e) => setCodigo(e.target.value)} leaves={leaves} contaByCode={contaByCode} />
        </Field>
      </Card>

      <Card className="mb-4">
        <h3 className="font-serif font-semibold text-ink mb-1">{conta ? `${conta.codigo} — ${conta.nome}` : ""}</h3>
        <div className="mb-3">{conta && <PillNatureza natureza={conta.natureza} />}</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <div className="text-xs text-inkSoft">Total de Débitos</div>
            <div className="font-semibold text-ink">{money(s.deb)}</div>
          </div>
          <div>
            <div className="text-xs text-inkSoft">Total de Créditos</div>
            <div className="font-semibold text-ink">{money(s.cred)}</div>
          </div>
          <div>
            <div className="text-xs text-inkSoft">Saldo Devedor</div>
            <div className="font-semibold text-ink">{s.dev ? money(s.dev) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-inkSoft">Saldo Credor</div>
            <div className="font-semibold text-ink">{s.cre ? money(s.cre) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-inkSoft">Lançamentos</div>
            <div className="font-semibold text-ink">{movs.length}</div>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <h3 className="font-serif font-semibold text-ink mb-3">Extrato (razão) — saldo acumulado</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Histórico</th>
              <th className="py-2 pr-3">Contrapartida</th>
              <th className="py-2 pr-3 text-right">Débito</th>
              <th className="py-2 pr-3 text-right">Crédito</th>
              <th className="py-2 pr-3 text-right">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/50 italic text-inkSoft">
              <td className="py-1.5 pr-3" colSpan={5}>
                Saldo inicial
              </td>
              <td className="py-1.5 pr-3 text-right">{numFmt(ini)}</td>
            </tr>
            {linhas.map(({ l, isDeb, saldoAcumulado: acumulado }) => {
              const contraCod = isDeb ? l.contaCredito : l.contaDebito;
              const contra = contaByCode[contraCod];
              return (
                <tr key={l.id} className="border-b border-line/50">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(l.data)}</td>
                  <td className="py-1.5 pr-3">{l.historico}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs" title={contra?.nome}>
                    {contraCod}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{isDeb ? numFmt(l.valor) : "—"}</td>
                  <td className="py-1.5 pr-3 text-right">{!isDeb ? numFmt(l.valor) : "—"}</td>
                  <td className="py-1.5 pr-3 text-right">{numFmt(acumulado)}</td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-inkSoft italic">
                  Nenhum lançamento para esta conta no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ============================================================================
// FASE 3 — Balancete de Verificação, DRE, Encerramento (ARE) e Balanço
// Patrimonial. Todos trabalham "dentro" da empresa ativa (mesmo padrão da
// Fase 2) e são apurados em tempo real a partir de lançamentos + saldos.
// ============================================================================

function LinhaDRE({ label, valor, tom = "" }) {
  const estilos = {
    subtotal: "font-semibold border-t border-line pt-1.5 mt-1",
    final: "font-bold border-t-2 border-ink pt-2 mt-2 text-base",
    indent: "pl-4 text-inkSoft",
  };
  return (
    <div className={`flex items-center justify-between py-0.5 text-sm ${estilos[tom] || ""}`}>
      <span>{label}</span>
      <span className="font-mono">{money(valor)}</span>
    </div>
  );
}

function LinhaBP({ label, valor, total }) {
  return (
    <div className={`flex items-center justify-between py-1 text-sm ${total ? "font-bold border-t-2 border-ink pt-2 mt-1" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">{money(valor)}</span>
    </div>
  );
}

// Linha de uma conta na árvore analítica do Balanço — indentação e peso da
// fonte crescem conforme o nível (Grupo > Subgrupo > Sintética > Analítica).
function LinhaBPAnalitica({ no }) {
  const { conta, valor, filhos } = no;
  const nivel = conta.nivel || 1;
  const estilo =
    nivel === 1 ? "font-bold text-ink" :
    nivel === 2 ? "font-semibold text-ink" :
    nivel === 3 ? "font-medium text-ink" :
    "text-inkSoft";
  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 py-1 text-sm ${estilo}`}
        style={{ paddingLeft: (nivel - 1) * 14 }}
      >
        <span className="flex gap-2 min-w-0">
          <span className="font-mono text-xs text-inkSoft shrink-0">{conta.codigo}</span>
          <span className="truncate">{conta.nome}</span>
        </span>
        <span className="font-mono shrink-0">{money(valor)}</span>
      </div>
      {filhos.map((f) => (
        <LinhaBPAnalitica key={f.conta.codigo} no={f} />
      ))}
    </>
  );
}

function SeloFechamento({ ok, rotulo, formula }) {
  return (
    <div
      className={
        "inline-flex flex-col items-center px-4 py-2 rounded-lg border mb-3 " +
        (ok ? "border-green/40 bg-green/10 text-green" : "border-red/40 bg-red/10 text-red")
      }
    >
      <span className="text-[10px] uppercase tracking-wide opacity-70">{rotulo}</span>
      <span className="font-serif font-bold">{ok ? "Fechado" : "Divergente"}</span>
      <span className="text-[10px] opacity-70">{ok ? formula : "verificar"}</span>
    </div>
  );
}

// ---- Balancete de Verificação ----

function GestaoBalanceteView({ empresa, lancamentos, saldos, leaves, contaByCode, perfil, empresas, notas, salvarNotas, registrarAuditoria }) {
  if (!empresa) return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima.</div>;

  let totDeb = 0, totCred = 0, totDev = 0, totCre = 0;
  const linhas = leaves.map((c) => {
    const s = saldoConta(lancamentos, saldos, contaByCode, c.codigo);
    totDeb += s.deb; totCred += s.cred; totDev += s.dev; totCre += s.cre;
    return { c, s };
  }).filter((r) => r.s.deb !== 0 || r.s.cred !== 0);

  const ok = Math.abs(totDeb - totCred) < 0.005;

  return (
    <div>
      <SeloFechamento ok={ok} rotulo="Balancete" formula="D = C" />
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Balancete de Verificação — {empresa.nome}</h2>
      <p className="text-sm text-inkSoft mb-4">
        Soma dos saldos iniciais com os lançamentos do período, por conta analítica. Somente contas
        com movimento aparecem na lista.
      </p>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Código</th>
              <th className="py-2 pr-3">Conta</th>
              <th className="py-2 pr-3">Natureza</th>
              <th className="py-2 pr-3 text-right">Total Débitos</th>
              <th className="py-2 pr-3 text-right">Total Créditos</th>
              <th className="py-2 pr-3 text-right">Saldo Devedor</th>
              <th className="py-2 pr-3 text-right">Saldo Credor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ c, s }) => (
              <tr key={c.codigo} className="border-b border-line/50">
                <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{c.codigo}</td>
                <td className="py-1.5 pr-3">{c.nome}</td>
                <td className="py-1.5 pr-3"><PillNatureza natureza={c.natureza} /></td>
                <td className="py-1.5 pr-3 text-right">{numFmt(s.deb)}</td>
                <td className="py-1.5 pr-3 text-right">{numFmt(s.cred)}</td>
                <td className="py-1.5 pr-3 text-right">{s.dev ? numFmt(s.dev) : "—"}</td>
                <td className="py-1.5 pr-3 text-right">{s.cre ? numFmt(s.cre) : "—"}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-inkSoft italic">
                  Nenhuma conta com movimento. Registre lançamentos ou saldos iniciais.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={3} className="py-2 pr-3">TOTAIS</td>
              <td className="py-2 pr-3 text-right">{numFmt(totDeb)}</td>
              <td className="py-2 pr-3 text-right">{numFmt(totCred)}</td>
              <td className="py-2 pr-3 text-right">{numFmt(totDev)}</td>
              <td className="py-2 pr-3 text-right">{numFmt(totCre)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
      <AtividadeAvaliativa
        moduloId="balancete"
        moduloLabel="Balancete de Verificação"
        perfil={perfil}
        empresas={empresas}
        notas={notas}
        salvarNotas={salvarNotas}
        registrarAuditoria={registrarAuditoria}
      />
    </div>
  );
}

// ---- DRE ----

function GestaoDREView({ empresa, lancamentos, saldos, perfil, empresas, notas, salvarNotas, registrarAuditoria }) {
  if (!empresa) return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima.</div>;
  const d = computeDRE(lancamentos, saldos);

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">
        Demonstração do Resultado do Exercício — {empresa.nome}
      </h2>
      <p className="text-sm text-inkSoft mb-4">
        Estrutura conforme a Lei nº 6.404/76 e a NBC TG 26 — apurada em tempo real a partir dos
        lançamentos e saldos iniciais desta empresa.
      </p>
      <Card>
        <LinhaDRE label="Receita Bruta de Vendas e Serviços" valor={d.receitaBruta} tom="indent" />
        <LinhaDRE label="(-) Deduções da Receita" valor={d.deducoes} tom="indent" />
        <LinhaDRE label="(=) Receita Líquida" valor={d.receitaLiquida} tom="subtotal" />
        <LinhaDRE label="(-) Custo das Mercadorias/Produtos/Serviços Vendidos" valor={d.cmv} tom="indent" />
        <LinhaDRE label="(=) Resultado Bruto" valor={d.resultadoBruto} tom="subtotal" />
        <LinhaDRE label="(-) Despesas Administrativas" valor={d.despAdm} tom="indent" />
        <LinhaDRE label="(-) Despesas Comerciais" valor={d.despCom} tom="indent" />
        <LinhaDRE label="(+) Outras Receitas Operacionais" valor={d.outrasReceitasOp} tom="indent" />
        <LinhaDRE label="(=) Resultado Antes do Resultado Financeiro" valor={d.resAntesFin} tom="subtotal" />
        <LinhaDRE label="(+) Receitas Financeiras" valor={d.receitasFin} tom="indent" />
        <LinhaDRE label="(-) Despesas Financeiras" valor={d.despFin} tom="indent" />
        <LinhaDRE label="(=) Resultado Operacional" valor={d.resOperacional} tom="subtotal" />
        <LinhaDRE label="(+) Ganhos de Capital / Resultado de Investimentos" valor={d.ganhosCapital} tom="indent" />
        <LinhaDRE label="(-) Outras Despesas" valor={d.outrasDesp} tom="indent" />
        <LinhaDRE label="(=) Resultado Antes do IRPJ e da CSLL" valor={d.resAntesIRPJ} tom="subtotal" />
        <LinhaDRE label="(-) Provisão para IRPJ e CSLL" valor={d.provIRPJCSLL} tom="indent" />
        <LinhaDRE label="(=) RESULTADO LÍQUIDO DO EXERCÍCIO" valor={d.resultadoLiquido} tom="final" />
      </Card>
      <AtividadeAvaliativa
        moduloId="dre"
        moduloLabel="DRE"
        perfil={perfil}
        empresas={empresas}
        notas={notas}
        salvarNotas={salvarNotas}
        registrarAuditoria={registrarAuditoria}
      />
    </div>
  );
}

// ---- Encerramento (ARE) ----

function GestaoEncerramentoView({ empresa, lancamentos, saldos, perfil, salvarLancamentos, registrarAuditoria, leaves, contaByCode }) {
  const [fechando, setFechando] = useState(false);
  if (!empresa) return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima.</div>;

  const totalReceitas = credMinusDebPrefix(lancamentos, saldos, "4");
  const totalDespesas = debMinusCredPrefix(lancamentos, saldos, "5");
  const totalCustos = debMinusCredPrefix(lancamentos, saldos, "6");
  const resultado = totalReceitas - totalDespesas - totalCustos;
  const lucro = resultado >= 0;
  const nadaParaFechar = Math.abs(totalReceitas) < 0.005 && Math.abs(totalDespesas) < 0.005 && Math.abs(totalCustos) < 0.005;

  const fecharAutomaticamente = async () => {
    if (
      !confirm(
        `Isso vai lançar automaticamente o encerramento de cada conta de Receita, Despesa e Custo com saldo (contra a ARE 7.1.01), e depois destinar o resultado (${lucro ? "lucro" : "prejuízo"} de ${money(Math.abs(resultado))}) ao Patrimônio Líquido.\n\nOs lançamentos ficam gravados no Livro Diário normalmente — você pode conferir e, se precisar, editar ou excluir depois. Confirma o fechamento?`
      )
    ) {
      return;
    }
    setFechando(true);
    try {
      const dataHoje = new Date().toISOString().slice(0, 10);
      const novos = [];
      const contasResultado = (leaves || []).filter((c) => ["4", "5", "6"].includes(c.codigo.split(".")[0]));
      for (const c of contasResultado) {
        const s = saldoConta(lancamentos, saldos, contaByCode, c.codigo);
        if (s.cre > 0.005) {
          novos.push({
            id: uid("l"), usuarioId: perfil?.uid, data: dataHoje,
            historico: `Encerramento — ${c.nome}`, contaDebito: c.codigo, contaCredito: "7.1.01",
            valor: Math.round(s.cre * 100) / 100, documento: "",
            observacoes: "Gerado automaticamente pelo fechamento do exercício.",
          });
        } else if (s.dev > 0.005) {
          novos.push({
            id: uid("l"), usuarioId: perfil?.uid, data: dataHoje,
            historico: `Encerramento — ${c.nome}`, contaDebito: "7.1.01", contaCredito: c.codigo,
            valor: Math.round(s.dev * 100) / 100, documento: "",
            observacoes: "Gerado automaticamente pelo fechamento do exercício.",
          });
        }
      }
      if (Math.abs(resultado) > 0.005) {
        novos.push({
          id: uid("l"), usuarioId: perfil?.uid, data: dataHoje,
          historico: "Destinação do resultado do exercício",
          contaDebito: lucro ? "7.1.01" : "3.9",
          contaCredito: lucro ? "3.9" : "7.1.01",
          valor: Math.round(Math.abs(resultado) * 100) / 100, documento: "",
          observacoes: "Gerado automaticamente pelo fechamento do exercício.",
        });
      }
      if (novos.length === 0) {
        alert("Não há saldo em contas de resultado para encerrar.");
        return;
      }
      await salvarLancamentos([...(lancamentos || []), ...novos]);
      await registrarAuditoria(
        "criar",
        "lancamento",
        `Fechou automaticamente o exercício da empresa "${empresa.nome}" — ${novos.length} lançamento(s) de encerramento`
      );
      alert(`Encerramento concluído — ${novos.length} lançamento(s) criado(s). Confira o Balanço Patrimonial.`);
    } finally {
      setFechando(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">
        1) Totais apurados no período por grupo de resultado — {empresa.nome}
      </h2>
      <p className="text-sm text-inkSoft mb-4">
        Esses totais são a base para o encerramento das contas de Receita, Despesa e Custo contra a
        conta 7.1.01 (ARE — Apuração do Resultado do Exercício).
      </p>

      {salvarLancamentos && (
        <Card className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <div className="font-semibold text-ink text-sm">Fechar automaticamente</div>
            <div className="text-xs text-inkSoft">
              Lança sozinho, conta por conta, o encerramento das contas de resultado e a destinação do
              lucro/prejuízo — sem precisar digitar cada lançamento manualmente em Lançamentos.
            </div>
          </div>
          <Botao onClick={fecharAutomaticamente} disabled={fechando || nadaParaFechar}>
            {fechando ? "Fechando…" : "Fechar automaticamente"}
          </Botao>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card>
          <div className="text-xs text-inkSoft">Total de Receitas (grupo 4)</div>
          <div className="font-serif font-semibold text-green">{money(totalReceitas)}</div>
        </Card>
        <Card>
          <div className="text-xs text-inkSoft">Total de Despesas (grupo 5)</div>
          <div className="font-serif font-semibold text-red">{money(totalDespesas)}</div>
        </Card>
        <Card>
          <div className="text-xs text-inkSoft">Total de Custos (grupo 6)</div>
          <div className="font-serif font-semibold text-red">{money(totalCustos)}</div>
        </Card>
        <Card>
          <div className="text-xs text-inkSoft">Resultado do Exercício</div>
          <div className={"font-serif font-semibold " + (lucro ? "text-green" : "text-red")}>{money(resultado)}</div>
        </Card>
      </div>

      <Card className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Conta Débito</th>
              <th className="py-2 pr-3">Conta Crédito</th>
              <th className="py-2 pr-3 text-right">Valor</th>
              <th className="py-2 pr-3">Observação</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/50">
              <td className="py-1.5 pr-3 font-mono text-xs">contas 4.*</td>
              <td className="py-1.5 pr-3 font-mono text-xs">7.1.01</td>
              <td className="py-1.5 pr-3 text-right">{numFmt(totalReceitas)}</td>
              <td className="py-1.5 pr-3">Encerramento das contas de Receita</td>
            </tr>
            <tr className="border-b border-line/50">
              <td className="py-1.5 pr-3 font-mono text-xs">7.1.01</td>
              <td className="py-1.5 pr-3 font-mono text-xs">contas 5.*</td>
              <td className="py-1.5 pr-3 text-right">{numFmt(totalDespesas)}</td>
              <td className="py-1.5 pr-3">Encerramento das contas de Despesa</td>
            </tr>
            <tr className="border-b border-line/50">
              <td className="py-1.5 pr-3 font-mono text-xs">7.1.01</td>
              <td className="py-1.5 pr-3 font-mono text-xs">contas 6.*</td>
              <td className="py-1.5 pr-3 text-right">{numFmt(totalCustos)}</td>
              <td className="py-1.5 pr-3">Encerramento das contas de Custo</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <h2 className="text-lg font-serif font-semibold text-ink mb-3">2) Destinação do resultado apurado</h2>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Conta Débito</th>
              <th className="py-2 pr-3">Conta Crédito</th>
              <th className="py-2 pr-3 text-right">Valor</th>
              <th className="py-2 pr-3">Observação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1.5 pr-3 font-mono text-xs">{lucro ? "7.1.01" : "3.9"}</td>
              <td className="py-1.5 pr-3 font-mono text-xs">{lucro ? "3.9" : "7.1.01"}</td>
              <td className="py-1.5 pr-3 text-right">{numFmt(Math.abs(resultado))}</td>
              <td className="py-1.5 pr-3">
                {lucro
                  ? "Lucro do período: debita ARE e credita Resultado do Exercício (PL)"
                  : "Prejuízo do período: debita Resultado do Exercício (PL) e credita ARE"}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
      <div className="text-xs text-inkSoft mt-3">
        <b>Observação didática:</b> a tabela acima mostra o roteiro por totais de grupo, só como
        referência resumida. O botão <b>"Fechar automaticamente"</b> lá em cima já faz o encerramento
        do jeito correto — conta a conta, uma por uma — e a destinação do resultado, tudo de uma vez.
        Se preferir praticar manualmente, pode digitar cada lançamento você mesmo no módulo
        Lançamentos, usando os totais desta tabela como referência.
      </div>
    </div>
  );
}

// ---- Balanço Patrimonial ----

function GestaoBalancoView({ empresa, lancamentos, saldos, contas }) {
  if (!empresa) return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima.</div>;

  const arvoreAtivo = construirArvoreBalanco(contas, "1", lancamentos, saldos, true);
  const arvorePassivo = construirArvoreBalanco(contas, "2", lancamentos, saldos, false);
  const arvorePL = construirArvoreBalanco(contas, "3", lancamentos, saldos, false);

  const totalAtivo = arvoreAtivo ? arvoreAtivo.valor : 0;
  const totalPassivo = arvorePassivo ? arvorePassivo.valor : 0;
  const totalPL = arvorePL ? arvorePL.valor : 0;
  const resultadoDRE = computeDRE(lancamentos, saldos).resultadoLiquido;
  const totalPassivoPL = totalPassivo + totalPL + resultadoDRE;
  const ok = Math.abs(totalAtivo - totalPassivoPL) < 0.005;

  const semSaldoPassivoPL =
    (!arvorePassivo || arvorePassivo.filhos.length === 0) && (!arvorePL || arvorePL.filhos.length === 0);

  return (
    <div>
      <SeloFechamento ok={ok} rotulo="Balanço" formula="A = P+PL" />
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Balanço Patrimonial — {empresa.nome}</h2>
      <p className="text-sm text-inkSoft mb-4">
        Detalhamento analítico — grupo, subgrupo, conta sintética e conta analítica — a partir dos
        saldos iniciais e dos lançamentos do período desta empresa. Só aparecem contas com saldo.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-serif font-semibold text-ink mb-2">ATIVO</h3>
          {arvoreAtivo && arvoreAtivo.filhos.length > 0 ? (
            arvoreAtivo.filhos.map((f) => <LinhaBPAnalitica key={f.conta.codigo} no={f} />)
          ) : (
            <div className="text-sm text-inkSoft italic py-1">Nenhum saldo lançado.</div>
          )}
          <LinhaBP label="TOTAL DO ATIVO" valor={totalAtivo} total />
        </Card>
        <Card>
          <h3 className="font-serif font-semibold text-ink mb-2">PASSIVO + PATRIMÔNIO LÍQUIDO</h3>
          {arvorePassivo && arvorePassivo.filhos.map((f) => <LinhaBPAnalitica key={f.conta.codigo} no={f} />)}
          {arvorePL && arvorePL.filhos.map((f) => <LinhaBPAnalitica key={f.conta.codigo} no={f} />)}
          {semSaldoPassivoPL && <div className="text-sm text-inkSoft italic py-1">Nenhum saldo lançado.</div>}
          <LinhaBP label="Resultado Líquido do Exercício (DRE)" valor={resultadoDRE} />
          <LinhaBP label="TOTAL DO PASSIVO + PL" valor={totalPassivoPL} total />
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// FASE 4 — Introdução à Contabilidade e Manual do Aluno. Conteúdo didático de
// apoio + o Controle de Estoque (PEPS/UEPS/Média Ponderada), que é global ao
// sistema (não por empresa) por ser um exercício comparativo, não ligado à
// escrituração de uma empresa específica.
// ============================================================================

function SubNav({ itens, atual, aoTrocar }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4 border-b border-line pb-3">
      {itens.map((s) => (
        <button
          key={s.id}
          onClick={() => aoTrocar(s.id)}
          className={
            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors " +
            (s.id === atual
              ? "bg-green text-white border-green"
              : "bg-transparent text-inkSoft border-line hover:border-green hover:text-green")
          }
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function ConceptCard({ titulo, children }) {
  return (
    <Card>
      <h4 className="font-serif font-semibold text-ink mb-1.5">{titulo}</h4>
      <p className="text-sm text-inkSoft">{children}</p>
    </Card>
  );
}

// ---- Introdução à Contabilidade ----

const INTRO_SUBS = [
  { id: "principios", label: "Princípios Contábeis" },
  { id: "classificacao", label: "Classificação de Contas" },
  { id: "estruturabp", label: "Estrutura do BP" },
  { id: "regimes", label: "Regimes Contábeis" },
];

const PRINCIPIOS_CONTABEIS = [
  ["Entidade", "Separa o patrimônio da empresa do patrimônio de seus sócios ou proprietários. A contabilidade registra os fatos da entidade, nunca os bens particulares dos donos."],
  ["Continuidade", "Assume-se que a entidade seguirá em operação por prazo indeterminado, salvo evidência em contrário. Essa premissa orienta, por exemplo, os critérios de avaliação de ativos."],
  ["Oportunidade", "Os fatos contábeis devem ser reconhecidos de forma tempestiva e completa, no momento em que ocorrem, garantindo informação íntegra e confiável."],
  ["Registro pelo Valor Original", "Os elementos patrimoniais são inicialmente registrados pelos valores de entrada (custo histórico), expressos em moeda nacional, podendo sofrer atualizações previstas em normas específicas."],
  ["Competência", "Receitas e despesas são reconhecidas no período em que ocorrem, independentemente de terem sido recebidas ou pagas. É o regime obrigatório para fins societários no Brasil."],
  ["Prudência (Conservadorismo)", "Diante de incerteza, adota-se o menor valor para ativos e receitas e o maior valor para passivos e despesas, evitando superavaliar o patrimônio."],
];

function IntroPrincipios() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Princípios Contábeis</h3>
      <p className="text-sm text-inkSoft mb-4">
        Doutrinariamente consolidados a partir da Resolução CFC nº 750/1993 e recepcionados pela
        Estrutura Conceitual do CPC/NBC TG, orientam todo o processo de registro e evidenciação
        contábil.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {PRINCIPIOS_CONTABEIS.map(([t, d]) => (
          <ConceptCard key={t} titulo={t}>{d}</ConceptCard>
        ))}
      </div>
    </div>
  );
}

function IntroClassificacao({ contas }) {
  const linhasClassificacao = [
    ["Ativo", "Patrimonial", "Devedora"],
    ["Passivo", "Patrimonial", "Credora"],
    ["Patrimônio Líquido", "Patrimonial", "Credora"],
    ["Receitas", "Resultado", "Credora"],
    ["Despesas", "Resultado", "Devedora"],
    ["Custos", "Resultado", "Devedora"],
    ["Resultado", "Apuração", "Variável"],
    ["Contas de Compensação", "Extrapatrimonial", "Compensação"],
  ];
  const contagem = (grupo) => contas.filter((c) => c.grupo === grupo && c.aceitaLancamento).length;

  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Classificação das Contas</h3>
      <p className="text-sm text-inkSoft mb-4">
        Todo o Plano de Contas do sistema deriva desta classificação. As contas dividem-se primeiro
        em <b>patrimoniais</b> (compõem o Balanço) e <b>de resultado</b> (compõem a DRE), além das
        contas de compensação.
      </p>
      <Card className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Grupo</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Natureza</th>
              <th className="py-2 pr-3 text-right">Contas analíticas no plano</th>
            </tr>
          </thead>
          <tbody>
            {linhasClassificacao.map(([grupo, tipo, natureza]) => (
              <tr key={grupo} className="border-b border-line/50">
                <td className="py-1.5 pr-3">{grupo}</td>
                <td className="py-1.5 pr-3">{tipo}</td>
                <td className="py-1.5 pr-3"><PillNatureza natureza={natureza} /></td>
                <td className="py-1.5 pr-3 text-right">{contagem(grupo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="text-xs text-inkSoft space-y-2">
        <p>
          <b>Regra de funcionamento das contas:</b> uma conta aumenta seu saldo quando lançada do
          lado da sua própria natureza (débito para devedoras, crédito para credoras) e diminui
          quando lançada do lado oposto. Contas redutoras — como "(-) Depreciação Acumulada" — têm
          natureza inversa à do grupo em que estão inseridas.
        </p>
        <p>
          <b>Hierarquia:</b> Grupo (1 dígito) → Subgrupo (1.1) → Conta Sintética (1.1.1) → Conta
          Analítica (1.1.1.01) → Subconta Analítica (1.1.1.01.01). Somente as contas analíticas e
          subcontas recebem lançamento — as demais servem apenas para totalização. Veja a lista
          completa no módulo <b>Plano de Contas</b>.
        </p>
      </div>
    </div>
  );
}

function IntroEstruturaBP() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Estrutura do Balanço Patrimonial</h3>
      <p className="text-sm text-inkSoft mb-4">
        O Balanço Patrimonial retrata, numa data específica, os bens e direitos (Ativo) e as
        obrigações e o patrimônio líquido (Passivo + PL) de uma entidade. Conforme a Lei nº
        6.404/76, os elementos são ordenados por grau decrescente de liquidez, no Ativo, e por grau
        decrescente de exigibilidade, no Passivo.
      </p>
      <div className="text-center font-serif font-bold text-ink text-lg mb-4">
        ATIVO <span className="text-gold mx-2">=</span> PASSIVO <span className="text-gold mx-2">+</span> PATRIMÔNIO LÍQUIDO
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Card>
          <h4 className="font-serif font-semibold text-ink mb-2">ATIVO</h4>
          <div className="text-sm text-inkSoft mb-2">
            <b className="text-ink">Circulante</b> — Bens e direitos realizáveis em até 12 meses:
            caixa, bancos, aplicações, clientes, estoques, despesas antecipadas.
          </div>
          <div className="text-sm text-inkSoft">
            <b className="text-ink">Não Circulante</b> — Realizável a Longo Prazo, Investimentos,
            Imobilizado e Intangível — realização prevista acima de 12 meses.
          </div>
        </Card>
        <Card>
          <h4 className="font-serif font-semibold text-ink mb-2">PASSIVO + PL</h4>
          <div className="text-sm text-inkSoft mb-2">
            <b className="text-ink">Passivo Circulante</b> — Obrigações exigíveis em até 12 meses:
            fornecedores, salários, tributos, empréstimos de curto prazo.
          </div>
          <div className="text-sm text-inkSoft mb-2">
            <b className="text-ink">Passivo Não Circulante</b> — Obrigações exigíveis acima de 12
            meses.
          </div>
          <div className="text-sm text-inkSoft">
            <b className="text-ink">Patrimônio Líquido</b> — Capital social, reservas e resultados
            acumulados — a diferença entre o Ativo e o Passivo exigível; representa os recursos
            próprios da entidade.
          </div>
        </Card>
      </div>
      <div className="text-xs text-inkSoft">
        O módulo <b>Balanço Patrimonial</b> deste sistema aplica exatamente esta estrutura,
        calculada automaticamente a partir dos lançamentos de cada empresa cadastrada.
      </div>
    </div>
  );
}

function IntroRegimes() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Regimes Contábeis</h3>
      <p className="text-sm text-inkSoft mb-4">
        Definem <b>quando</b> uma receita ou despesa deve ser reconhecida nos registros contábeis.
      </p>
      <Card className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3 w-40"></th>
              <th className="py-2 pr-3">Regime de Caixa</th>
              <th className="py-2 pr-3">Regime de Competência</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/50">
              <td className="py-2 pr-3 font-semibold text-ink">Reconhecimento</td>
              <td className="py-2 pr-3">No momento do efetivo recebimento ou pagamento em dinheiro.</td>
              <td className="py-2 pr-3">No momento em que o fato gerador ocorre, independentemente do recebimento/pagamento.</td>
            </tr>
            <tr className="border-b border-line/50">
              <td className="py-2 pr-3 font-semibold text-ink">Uso permitido</td>
              <td className="py-2 pr-3">Controles gerenciais simples, pessoa física, fluxo de caixa.</td>
              <td className="py-2 pr-3">Obrigatório para a escrituração societária, por força da Lei nº 6.404/76 e das NBC TG.</td>
            </tr>
            <tr className="border-b border-line/50">
              <td className="py-2 pr-3 font-semibold text-ink">Exemplo</td>
              <td className="py-2 pr-3">Venda a prazo em dezembro, recebida em fevereiro: a receita só é registrada em fevereiro.</td>
              <td className="py-2 pr-3">A mesma venda: a receita é registrada em dezembro (quando ocorre a venda), e "Clientes" registra o direito a receber.</td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-semibold text-ink">Vantagem</td>
              <td className="py-2 pr-3">Simplicidade operacional.</td>
              <td className="py-2 pr-3">Reflete com fidelidade a real situação patrimonial e o resultado do período.</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <div className="text-xs text-inkSoft">
        O Livro Diário deste sistema (módulo <b>Lançamentos</b>) segue o <b>regime de
        competência</b>: ao lançar uma venda a prazo, por exemplo, debita-se "Clientes" (Ativo) e
        credita-se a conta de receita — o caixa só é afetado quando o valor for efetivamente
        recebido, em um lançamento posterior.
      </div>
    </div>
  );
}

// ---- Controle de Estoque (PEPS / UEPS / Média Ponderada) ----
// Movimentações globais ao sistema (não por empresa) — é um exercício
// comparativo de método de custeio, não uma escrituração real de uma empresa.

function computeKardexPEPS(movs) {
  let lots = [], cmvTotal = 0;
  const rows = movs.map((m) => {
    let obs = "";
    if (m.tipo === "Entrada") {
      lots.push({ qtd: Number(m.quantidade), valorUnit: Number(m.valorUnit) });
    } else {
      let falta = Number(m.quantidade), custo = 0;
      while (falta > 0.0001 && lots.length) {
        const lot = lots[0];
        if (lot.qtd <= falta + 0.0001) { custo += lot.qtd * lot.valorUnit; falta -= lot.qtd; lots.shift(); }
        else { custo += falta * lot.valorUnit; lot.qtd -= falta; falta = 0; }
      }
      if (falta > 0.0001) obs = "estoque insuficiente";
      cmvTotal += custo;
      m = { ...m, custoSaida: custo };
    }
    const saldoQtd = lots.reduce((s, l) => s + l.qtd, 0);
    const saldoValor = lots.reduce((s, l) => s + l.qtd * l.valorUnit, 0);
    return { ...m, saldoQtd, saldoValor, obs };
  });
  return { rows, estoqueFinalQtd: lots.reduce((s, l) => s + l.qtd, 0), estoqueFinalValor: lots.reduce((s, l) => s + l.qtd * l.valorUnit, 0), cmvTotal };
}

function computeKardexUEPS(movs) {
  let lots = [], cmvTotal = 0;
  const rows = movs.map((m) => {
    let obs = "";
    if (m.tipo === "Entrada") {
      lots.push({ qtd: Number(m.quantidade), valorUnit: Number(m.valorUnit) });
    } else {
      let falta = Number(m.quantidade), custo = 0;
      while (falta > 0.0001 && lots.length) {
        const lot = lots[lots.length - 1];
        if (lot.qtd <= falta + 0.0001) { custo += lot.qtd * lot.valorUnit; falta -= lot.qtd; lots.pop(); }
        else { custo += falta * lot.valorUnit; lot.qtd -= falta; falta = 0; }
      }
      if (falta > 0.0001) obs = "estoque insuficiente";
      cmvTotal += custo;
      m = { ...m, custoSaida: custo };
    }
    const saldoQtd = lots.reduce((s, l) => s + l.qtd, 0);
    const saldoValor = lots.reduce((s, l) => s + l.qtd * l.valorUnit, 0);
    return { ...m, saldoQtd, saldoValor, obs };
  });
  return { rows, estoqueFinalQtd: lots.reduce((s, l) => s + l.qtd, 0), estoqueFinalValor: lots.reduce((s, l) => s + l.qtd * l.valorUnit, 0), cmvTotal };
}

function computeKardexMP(movs) {
  let qtd = 0, valorTotal = 0, cmvTotal = 0;
  const rows = movs.map((m) => {
    let obs = "";
    if (m.tipo === "Entrada") {
      qtd += Number(m.quantidade);
      valorTotal += Number(m.quantidade) * Number(m.valorUnit);
    } else {
      if (Number(m.quantidade) > qtd + 0.0001) obs = "estoque insuficiente";
      const custoUnitAtual = qtd > 0 ? valorTotal / qtd : 0;
      const custoSaida = Math.min(Number(m.quantidade), qtd) * custoUnitAtual;
      cmvTotal += custoSaida;
      qtd -= Math.min(Number(m.quantidade), qtd);
      valorTotal -= custoSaida;
      m = { ...m, custoSaida };
    }
    return { ...m, saldoQtd: qtd, saldoValor: valorTotal, obs };
  });
  return { rows, estoqueFinalQtd: qtd, estoqueFinalValor: valorTotal, cmvTotal };
}

function KardexColuna({ titulo, k }) {
  return (
    <div className="min-w-[280px]">
      <h5 className="font-serif font-semibold text-ink text-center border-b-2 border-ink pb-2 mb-2 text-sm">
        {titulo}
      </h5>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-inkSoft border-b border-line">
              <th className="py-1 pr-2">Data</th>
              <th className="py-1 pr-2">Mov.</th>
              <th className="py-1 pr-2 text-right">Qtd</th>
              <th className="py-1 pr-2 text-right">Vlr Unit.</th>
              <th className="py-1 pr-2 text-right">Saldo Qtd</th>
              <th className="py-1 pr-2 text-right">Saldo Vlr</th>
            </tr>
          </thead>
          <tbody>
            {k.rows.map((r, i) => (
              <tr key={i} className="border-b border-line/50 whitespace-nowrap">
                <td className="py-1 pr-2">{fmtDate(r.data)}</td>
                <td className="py-1 pr-2">
                  {r.tipo}
                  {r.obs && <span className="text-red"> ⚠</span>}
                </td>
                <td className="py-1 pr-2 text-right">{r.quantidade}</td>
                <td className="py-1 pr-2 text-right">
                  {r.tipo === "Entrada" ? numFmt(r.valorUnit) : r.custoSaida != null ? numFmt(r.custoSaida / r.quantidade) : "—"}
                </td>
                <td className="py-1 pr-2 text-right">{r.saldoQtd}</td>
                <td className="py-1 pr-2 text-right">{numFmt(r.saldoValor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Deriva as movimentações de estoque diretamente dos lançamentos da empresa —
// qualquer lançamento cuja conta débito ou crédito tenha controlaEstoque=true
// vira uma "Entrada" (débito) ou "Saída" (crédito) na ficha kardex. Não existe
// mais cadastro manual de movimentação: é só ler o extrato dos Lançamentos.
function derivarMovimentosEstoque(lancamentos, contaByCode) {
  return (lancamentos || [])
    .map((l) => {
      const deb = contaByCode[l.contaDebito];
      const cred = contaByCode[l.contaCredito];
      const quantidade = Number(l.quantidade) || 0;
      if (deb?.controlaEstoque && quantidade > 0) {
        return {
          id: l.id, data: l.data, tipo: "Entrada", quantidade,
          valorUnit: l.valorUnitario != null ? Number(l.valorUnitario) : (quantidade ? Number(l.valor) / quantidade : 0),
          contaCodigo: deb.codigo, contaNome: deb.nome, historico: l.historico,
        };
      }
      if (cred?.controlaEstoque && quantidade > 0) {
        return {
          id: l.id, data: l.data, tipo: "Saída", quantidade,
          contaCodigo: cred.codigo, contaNome: cred.nome, historico: l.historico,
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.data.localeCompare(b.data));
}

function GestaoEstoqueView({ empresa, lancamentos, contaByCode, perfil, empresas, notas, salvarNotas, registrarAuditoria }) {
  if (!empresa) {
    return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima para ver o estoque.</div>;
  }

  const contasDeEstoque = Object.values(contaByCode).filter((c) => c.controlaEstoque);
  const movs = derivarMovimentosEstoque(lancamentos, contaByCode);

  const peps = computeKardexPEPS(movs);
  const ueps = computeKardexUEPS(movs);
  const mp = computeKardexMP(movs);

  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Controle de Estoque — {empresa.nome}</h3>
      <p className="text-sm text-inkSoft mb-4">
        Somente consulta — atualizado automaticamente a partir dos lançamentos desta empresa.
        Compare como cada critério de avaliação afeta o Custo da Mercadoria Vendida (CMV) e o
        valor do estoque final.
      </p>

      <Card className="mb-4">
        <div className="text-sm text-inkSoft">
          <b className="text-ink">Como movimentar o estoque:</b> vá ao módulo{" "}
          <b>Lançamentos</b> e registre a compra ou a venda/consumo normalmente. Quando a conta de
          débito ou de crédito for uma conta marcada como "Controla estoque" no Plano de Contas,
          um campo <b>Quantidade</b> aparece no formulário — é ele que alimenta esta tela.
        </div>
        {contasDeEstoque.length > 0 && (
          <div className="text-xs text-inkSoft mt-2">
            Contas de estoque cadastradas no plano:{" "}
            {contasDeEstoque.map((c) => `${c.codigo} — ${c.nome}`).join(" · ")}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <ConceptCard titulo="PEPS · FIFO — Primeiro que Entra, Primeiro que Sai">
          As saídas são baixadas pelo custo dos lotes mais antigos em estoque. Em cenários de
          preços crescentes, tende a gerar CMV menor e estoque final mais próximo do valor de
          reposição.
        </ConceptCard>
        <ConceptCard titulo="UEPS · LIFO — Último que Entra, Primeiro que Sai">
          As saídas são baixadas pelo custo dos lotes mais recentes. Tende a aproximar o CMV do
          custo de reposição atual.{" "}
          <span className="text-red">
            ⚠ Não é aceito pela legislação fiscal brasileira nem pelo CPC 16 / NBC TG 16 —
            apresentado aqui apenas para fins comparativos e didáticos.
          </span>
        </ConceptCard>
        <ConceptCard titulo="MP — Média Ponderada Móvel">
          A cada nova entrada, recalcula-se o custo médio unitário do estoque. As saídas seguintes
          são baixadas por esse custo médio, até a entrada seguinte.
        </ConceptCard>
      </div>

      {movs.length === 0 ? (
        <Card>
          <div className="text-sm text-inkSoft italic">
            Nenhuma movimentação de estoque ainda. Registre uma compra ou venda envolvendo uma
            conta de estoque no módulo Lançamentos para ver a ficha kardex aqui.
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <Card><div className="text-xs text-inkSoft">Estoque Final — PEPS</div><div className="font-semibold text-ink">{peps.estoqueFinalQtd} un · {money(peps.estoqueFinalValor)}</div></Card>
            <Card><div className="text-xs text-inkSoft">Estoque Final — UEPS</div><div className="font-semibold text-ink">{ueps.estoqueFinalQtd} un · {money(ueps.estoqueFinalValor)}</div></Card>
            <Card><div className="text-xs text-inkSoft">Estoque Final — Média Ponderada</div><div className="font-semibold text-ink">{mp.estoqueFinalQtd} un · {money(mp.estoqueFinalValor)}</div></Card>
            <Card><div className="text-xs text-inkSoft">CMV — PEPS</div><div className="font-semibold text-red">{money(peps.cmvTotal)}</div></Card>
            <Card><div className="text-xs text-inkSoft">CMV — UEPS</div><div className="font-semibold text-red">{money(ueps.cmvTotal)}</div></Card>
            <Card><div className="text-xs text-inkSoft">CMV — Média Ponderada</div><div className="font-semibold text-red">{money(mp.cmvTotal)}</div></Card>
          </div>

          <h3 className="font-serif font-semibold text-ink mb-3">Movimentações (origem: Lançamentos)</h3>
          <Card className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-inkSoft border-b border-line">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Movimento</th>
                  <th className="py-2 pr-3">Conta</th>
                  <th className="py-2 pr-3">Histórico</th>
                  <th className="py-2 pr-3 text-right">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id} className="border-b border-line/50">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(m.data)}</td>
                    <td className="py-1.5 pr-3">
                      <Pill tone={m.tipo === "Entrada" ? "green" : "gold"}>{m.tipo}</Pill>
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{m.contaCodigo}</td>
                    <td className="py-1.5 pr-3">{m.historico}</td>
                    <td className="py-1.5 pr-3 text-right">{m.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <h3 className="font-serif font-semibold text-ink mb-3">Ficha de controle (kardex) comparativa</h3>
          <Card className="overflow-x-auto">
            <div className="grid sm:grid-cols-3 gap-4">
              <KardexColuna titulo="PEPS" k={peps} />
              <KardexColuna titulo="UEPS" k={ueps} />
              <KardexColuna titulo="Média Ponderada" k={mp} />
            </div>
          </Card>
          <div className="text-xs text-inkSoft mt-3">
            Os três métodos partem exatamente das mesmas movimentações — lance mais compras e
            vendas em Lançamentos para ver o impacto de cada critério no CMV e no estoque final.
          </div>
        </>
      )}
      <AtividadeAvaliativa
        moduloId="estoque"
        moduloLabel="Controle de Estoque"
        perfil={perfil}
        empresas={empresas}
        notas={notas}
        salvarNotas={salvarNotas}
        registrarAuditoria={registrarAuditoria}
      />
    </div>
  );
}

function GestaoIntroducaoView({ contas, perfil, empresas, notas, salvarNotas, registrarAuditoria }) {
  const [sub, setSub] = useState("principios");
  return (
    <div>
      <SubNav itens={INTRO_SUBS} atual={sub} aoTrocar={setSub} />
      {sub === "principios" && <IntroPrincipios />}
      {sub === "classificacao" && <IntroClassificacao contas={contas} />}
      {sub === "estruturabp" && <IntroEstruturaBP />}
      {sub === "regimes" && <IntroRegimes />}
      <AtividadeAvaliativa
        moduloId="introducao"
        moduloLabel="Introdução à Contabilidade"
        perfil={perfil}
        empresas={empresas}
        notas={notas}
        salvarNotas={salvarNotas}
        registrarAuditoria={registrarAuditoria}
      />
    </div>
  );
}

// ---- Manual do Aluno ----

const MANUAL_SUBS = [
  { id: "acesso", label: "Cadastro e Acesso" },
  { id: "ciclo", label: "Lançamentos (Ciclo Contábil)" },
  { id: "relatoriosdica", label: "Entendendo os Relatórios" },
  { id: "faq", label: "Perguntas Frequentes" },
  { id: "glossario", label: "Glossário" },
];

// ---- Ilustrações (mockups numerados das telas reais) para o Manual do Aluno ----

function NumBadge({ n }) {
  return (
    <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-green text-white text-[11px] font-bold flex items-center justify-center shadow-soft z-10">
      {n}
    </span>
  );
}

function CampoIlustrado({ n, label, valor, className = "" }) {
  return (
    <div className={"relative border border-line rounded-lg px-3 py-2 bg-paper " + className}>
      <NumBadge n={n} />
      <div className="text-[10px] text-inkSoft">{label}</div>
      <div className="text-sm text-ink truncate">{valor}</div>
    </div>
  );
}

// Mockup do formulário de Lançamentos — a numeração bate exatamente com os
// passos 1 a 7 explicados abaixo, no texto do Manual.
function IlustracaoLancamento() {
  return (
    <div className="border-2 border-dashed border-line rounded-xl p-4 bg-white mb-4">
      <div className="text-[10px] uppercase tracking-wide text-inkSoft mb-2">
        Como é a tela real de Lançamentos — os números batem com os passos abaixo
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <CampoIlustrado n={1} label="Data" valor="03/08/2026" />
        <CampoIlustrado n={2} label="Tipo de operação (opcional)" valor="Venda" />
      </div>
      <CampoIlustrado n={3} label="Histórico do fato contábil" valor="Venda de mercadorias à vista" className="mb-3" />
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <CampoIlustrado n={4} label="Conta débito" valor="1.1.1.01 — Caixa Geral" />
        <CampoIlustrado n={4} label="Conta crédito" valor="4.1.1.01 — Vendas de Mercadorias" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <CampoIlustrado n={5} label="Valor (R$)" valor="500,00" />
        <div className="grid grid-cols-2 gap-2">
          <CampoIlustrado n={6} label="Documento" valor="NF 1234" />
          <CampoIlustrado n={6} label="Observações" valor="" />
        </div>
      </div>
      <div className="relative inline-block">
        <NumBadge n={7} />
        <div className="bg-green text-white text-sm font-semibold px-4 py-2 rounded-lg">Adicionar lançamento</div>
      </div>
    </div>
  );
}

// Mockup do seletor de Empresa ativa — acompanha o passo 3 dos Primeiros Passos.
// Mockup da tela de Login — E-mail, Senha e botão Entrar.
// Mockup da tela de entrada — escolha de perfil + botão do Google.
function IlustracaoLogin() {
  return (
    <div className="border-2 border-dashed border-line rounded-xl p-4 bg-white mb-4 max-w-xs">
      <div className="space-y-3">
        <div className="relative">
          <NumBadge n={1} />
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green text-white text-xs font-semibold px-3 py-2 rounded-lg text-center">Aluno(a)</div>
            <div className="border border-line text-inkSoft text-xs font-semibold px-3 py-2 rounded-lg text-center">Professor(a)</div>
          </div>
        </div>
        <div className="relative">
          <NumBadge n={2} />
          <div className="border border-line bg-paper text-ink text-sm font-semibold px-4 py-2 rounded-lg text-center flex items-center justify-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 via-red-500 to-yellow-400 inline-block" />
            Continuar com o Google
          </div>
        </div>
      </div>
    </div>
  );
}

// Mockup da telinha que aparece depois do Google, no primeiro login de um
// Aluno(a) — só pede a matrícula, para achar a turma certa.
function IlustracaoCadastro() {
  return (
    <div className="border-2 border-dashed border-line rounded-xl p-4 bg-white mb-4 max-w-xs">
      <div className="space-y-3">
        <CampoIlustrado n={1} label="Matrícula" valor="2024001" />
        <div className="relative">
          <NumBadge n={2} />
          <div className="bg-green text-white text-sm font-semibold px-4 py-2 rounded-lg text-center">Entrar</div>
        </div>
      </div>
    </div>
  );
}

function IlustracaoEmpresaAtiva() {
  return (
    <div className="border-2 border-dashed border-line rounded-xl p-4 bg-white mb-4 max-w-md">
      <div className="text-[10px] uppercase tracking-wide text-inkSoft mb-2">
        Este seletor aparece no topo de Saldos, Lançamentos, Consulta, Balancete, DRE, Encerramento,
        Balanço e Relatórios
      </div>
      <CampoIlustrado n={3} label="Empresa ativa" valor="— Selecione uma empresa —" />
    </div>
  );
}

function PassoManual({ n, titulo, children }) {
  return (
    <div className="flex gap-3 mb-3">
      <div className="w-6 h-6 rounded-full bg-green text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <div className="font-semibold text-ink text-sm">{titulo}</div>
        <div className="text-sm text-inkSoft">{children}</div>
      </div>
    </div>
  );
}

// ---- Helpers de ilustração reutilizáveis para o Manual (tabelas, DRE, Balanço) ----

function TabelaIlustrada({ colunas, linhas, legenda, badgeColuna }) {
  return (
    <div className="border-2 border-dashed border-line rounded-xl p-4 bg-white mb-4 overflow-x-auto">
      {legenda && <div className="text-[10px] uppercase tracking-wide text-inkSoft mb-2">{legenda}</div>}
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-green text-white">
            {colunas.map((c, i) => (
              <th key={i} className="text-left py-1.5 px-2 font-semibold relative whitespace-nowrap">
                {badgeColuna === i && <NumBadge n={1} />}
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, li) => (
            <tr key={li} className={li % 2 === 0 ? "bg-paper" : "bg-white"}>
              {linha.map((cel, ci) => (
                <td key={ci} className="py-1.5 px-2 border-b border-line/50 whitespace-nowrap">{cel}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubSecaoTitulo({ numero, children }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-2">
      <div className="w-1.5 h-5 bg-gold rounded shrink-0" />
      <h4 className="font-serif font-bold text-green text-base">
        {numero} {children}
      </h4>
    </div>
  );
}

function DRECascataIlustrada({ linhas }) {
  return (
    <div className="border-2 border-dashed border-line rounded-xl p-4 bg-white mb-4">
      {linhas.map(([label, valor, estilo], i) => (
        <div
          key={i}
          className={
            "flex items-center justify-between py-1 text-sm " +
            (estilo === "final"
              ? "font-bold border-t-2 border-ink pt-2 mt-1"
              : estilo === "sub"
              ? "font-semibold border-t border-line pt-1"
              : "text-inkSoft")
          }
        >
          <span>{label}</span>
          <span className="font-mono">{valor}</span>
        </div>
      ))}
    </div>
  );
}

function BalancoIlustrado({ ativo, passivo }) {
  const Coluna = ({ titulo, linhas }) => (
    <div>
      <h5 className="font-serif font-bold text-green text-sm mb-2">{titulo}</h5>
      {linhas.map(([label, valor, estilo], i) => (
        <div
          key={i}
          className={
            "flex items-center justify-between py-1 text-sm " +
            (estilo === "final" ? "font-bold border-t-2 border-ink pt-2 mt-1" : "")
          }
        >
          <span>{label}</span>
          <span className="font-mono">{valor}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="border-2 border-dashed border-line rounded-xl p-4 bg-white mb-4 grid sm:grid-cols-2 gap-6">
      <Coluna titulo="ATIVO" linhas={ativo} />
      <Coluna titulo="PASSIVO + PATRIMÔNIO LÍQUIDO" linhas={passivo} />
    </div>
  );
}

function ManualAcesso() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Cadastro do Aluno e Acesso</h3>
      <p className="text-sm text-inkSoft mb-4">
        O acesso ao sistema é feito só com sua conta Google — não existe mais cadastro por e-mail e senha.
      </p>

      <h4 className="font-semibold text-ink text-sm mb-1">Tela de entrada (Login)</h4>
      <p className="text-sm text-inkSoft mb-3">
        Escolha seu perfil — <b>Aluno(a)</b> ou <b>Professor(a)</b> — e clique em "Continuar com o Google".
        Use a mesma conta Google sempre, para não perder o acesso.
      </p>
      <IlustracaoLogin />

      <h4 className="font-semibold text-ink text-sm mb-1">Primeiro login — Aluno(a)</h4>
      <p className="text-sm text-inkSoft mb-3">
        Depois do Google, é pedida sua <b>matrícula</b>. O professor(a) já precisa ter cadastrado seu nome e
        matrícula na turma (módulo Turmas → "Alunos esperados") — se a matrícula não for encontrada, o sistema
        avisa e você deve procurar o professor(a) antes de tentar de novo.
      </p>
      <IlustracaoCadastro />

      <div className="text-sm text-inkSoft bg-gold/10 border border-gold/40 rounded-lg p-3 mb-4">
        <b>A partir do segundo acesso:</b> mesmo já logado pelo Google, o sistema pede a matrícula de novo a
        cada entrada — é uma confirmação extra de identidade, igual à senha mestre do Mestre. Não fica salva
        entre sessões.
      </div>

      <h4 className="font-semibold text-ink text-sm mb-1">Primeiro login — Professor(a)</h4>
      <div className="text-sm text-inkSoft bg-gold/10 border border-gold/40 rounded-lg p-3 mb-4">
        Depois do Google, é pedido um <b>Código de Mestre</b> (opcional — só preencha se um Usuário Mestre te
        passou um). Sem o código, sua conta vira Professor(a) e fica <b>pendente</b> até um Mestre aprová-la.
      </div>

      <h4 className="font-semibold text-ink text-sm mb-1">Empresa ativa</h4>
      <p className="text-sm text-inkSoft mb-3">
        Depois de entrar, quase todos os módulos do ciclo contábil trabalham "dentro" de uma
        empresa específica. Confirme sempre qual empresa está selecionada antes de lançar algo.
      </p>
      <IlustracaoEmpresaAtiva />

      <h4 className="font-semibold text-ink text-sm mb-1">Resumo geral dos primeiros passos</h4>
      <Card>
        <PassoManual n={1} titulo="Peça ao professor(a) para te cadastrar na turma">
          No módulo <b>Turmas</b>, o professor(a) registra seu nome e sua matrícula em "Alunos esperados" —
          sem isso, seu primeiro login não encontra a turma certa.
        </PassoManual>
        <PassoManual n={2} titulo="Entre com sua conta Google">
          Escolha o perfil Aluno(a), clique em "Continuar com o Google" e informe sua matrícula quando pedido.
        </PassoManual>
        <PassoManual n={3} titulo="Selecione a empresa ativa">
          Confirme que está correto antes de começar — tudo o que você fizer fica registrado
          nessa empresa.
        </PassoManual>
        <PassoManual n={4} titulo="Conheça o Plano de Contas">
          Antes de lançar, dê uma olhada no módulo <b>Plano de Contas</b> para se familiarizar com
          os códigos e nomes das contas que você vai usar com mais frequência.
        </PassoManual>
        <PassoManual n={5} titulo="Comece a lançar">
          Vá para o módulo <b>Lançamentos</b> e registre os fatos contábeis do seu exercício, um
          de cada vez, em partidas dobradas.
        </PassoManual>
        <PassoManual n={6} titulo="Acompanhe os relatórios">
          Depois de lançar, confira o <b>Balancete</b> (deve fechar "Fechado"), a <b>DRE</b> e o{" "}
          <b>Balanço Patrimonial</b>. Eles são calculados automaticamente, sem precisar de nenhum
          botão de "atualizar".
        </PassoManual>
        <PassoManual n={7} titulo="Seus dados já ficam salvos na nuvem">
          Tudo é sincronizado automaticamente — não é preciso baixar backup manual para não
          perder o trabalho.
        </PassoManual>
      </Card>
      <div className="text-xs text-inkSoft mt-3">
        <b>Sobre permissões:</b> como Aluno, algumas ações ficam bloqueadas por padrão — excluir
        lançamentos, excluir empresas, entre outras. Isso é proposital, para evitar exclusões
        acidentais. Se precisar de alguma dessas ações, peça a um usuário <b>Mestre</b> ou{" "}
        <b>Professor</b> para liberá-la para você no módulo Usuários (botão "Permissões").
      </div>
    </div>
  );
}

function ManualCicloContabil() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Lançamentos (Ciclo Contábil)</h3>
      <p className="text-sm text-inkSoft mb-4">
        Todo o fluxo operacional de uma empresa dentro do sistema — do plano de contas até o
        balanço final — organizado na ordem em que você normalmente usa.
      </p>

      <SubSecaoTitulo numero="1.">Plano de Contas</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        As 292 contas do curso, organizadas por Grupo, Tipo e Natureza. Só as contas analíticas e
        subcontas recebem lançamento.
      </p>
      <TabelaIlustrada
        legenda="Busque por código ou nome para filtrar as 292 contas"
        colunas={["Código", "Conta", "Nível", "Grupo", "Natureza", "Lanç.?", "Estoque?"]}
        badgeColuna={0}
        linhas={[
          ["1.1.1", "Caixa e Equivalentes de Caixa", "3", "Ativo", "Devedora", "—", "—"],
          ["1.1.1.01", "Caixa Geral", "4", "Ativo", "Devedora", "Sim", "—"],
          ["1.1.3.01", "Mercadorias para Revenda", "4", "Ativo", "Devedora", "Sim", "Sim"],
        ]}
      />
      <p className="text-xs text-inkSoft mb-2">
        Contas marcadas "Sim" na coluna "Estoque?" são contas físicas de estoque — usá-las num
        lançamento habilita o campo Quantidade (veja a seção 5, Controle de Estoque). Só um Mestre
        pode marcar essa opção, na edição da conta.
      </p>

      <SubSecaoTitulo numero="2.">Saldos Iniciais</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        É o lançamento de abertura da sua empresa: credite <b>Capital Subscrito</b> pelo total
        investido pelos sócios, e distribua o mesmo valor em débito entre uma ou mais contas de
        Ativo — Caixa, Bancos ou Imobilizado (móveis, veículos, máquinas etc.).
      </p>
      <TabelaIlustrada
        legenda="Exemplo: sócios integralizam R$ 20.000, parte em dinheiro e parte em equipamento"
        colunas={["Código", "Conta", "Natureza", "Saldo Devedor", "Saldo Credor"]}
        badgeColuna={3}
        linhas={[
          ["1.1.1.01", "Caixa Geral", "Devedora", "15.000,00", ""],
          ["1.2.3.05", "Máquinas e Equipamentos", "Devedora", "5.000,00", ""],
          ["3.1.01", "Capital Subscrito", "Credora", "", "20.000,00"],
        ]}
      />
      <p className="text-xs text-inkSoft mb-2">
        A tela mostra só essas contas de abertura por padrão (link "Mostrar todas as contas" pra
        casos excepcionais). O sistema confirma "OK" quando a soma dos saldos devedores bate com a
        soma dos credores.
      </p>

      <SubSecaoTitulo numero="3.">Lançamentos</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        Todo lançamento representa um fato contábil e sempre usa duas contas: uma a débito e uma a
        crédito, no mesmo valor.
      </p>
      <IlustracaoLancamento />
      <Card className="mb-4">
        <PassoManual n={1} titulo="Data">Informe a data em que o fato ocorreu (não precisa ser a data de hoje).</PassoManual>
        <PassoManual n={2} titulo="Tipo de operação">
          Campo opcional — hoje com "Compra" ou "Venda". Ao escolher, o campo Histórico é
          preenchido automaticamente com uma sugestão.
        </PassoManual>
        <PassoManual n={3} titulo="Histórico">
          Descreva o fato em poucas palavras — ex.: "Venda de mercadorias à vista".
        </PassoManual>
        <PassoManual n={4} titulo="Conta débito e Conta crédito">
          Digite o código ou nome da conta para filtrar a lista e escolha. Nunca use a mesma conta
          nos dois campos.
        </PassoManual>
        <PassoManual n={5} titulo="Valor">Digite o valor da operação — ele será usado igualmente nas duas contas.</PassoManual>
        <PassoManual n={6} titulo="Documento e Observações">
          Campos opcionais, úteis para anotar o número da nota fiscal ou detalhes extras.
        </PassoManual>
        <PassoManual n={7} titulo="Adicionar lançamento">
          Clique no botão — o lançamento aparece imediatamente no Livro Diário logo abaixo, e
          todos os relatórios já são recalculados.
        </PassoManual>
        <PassoManual n={8} titulo="Contas de estoque: Quantidade, Valor unitário e Valor Total">
          Se a conta débito ou crédito escolhida controla estoque (ex.: "Mercadorias para
          Revenda"), o formulário muda: numa <b>compra</b> (débito na conta de estoque), você
          digita Quantidade e Valor unitário, e o Valor Total é calculado sozinho. Numa{" "}
          <b>venda</b> (crédito na conta de estoque), você digita Quantidade e Valor Total (o
          valor da venda), e o Valor unitário aparece só como referência — o custo de cada
          método (PEPS/UEPS/MP) é calculado à parte, no Controle de Estoque.
        </PassoManual>
      </Card>
      <div className="text-xs text-inkSoft mb-4 space-y-2">
        <p>
          <b>Exemplo de compra:</b> Conta débito: 1.1.3.01 Mercadorias para Revenda · Conta
          crédito: 1.1.1.01 Caixa Geral · Quantidade: 100 · Valor unitário: 5,00 · Valor Total:
          500,00 (calculado sozinho).
        </p>
        <p>
          <b>Exemplo de venda:</b> Conta débito: 1.1.1.01 Caixa Geral · Conta crédito: 1.1.3.01
          Mercadorias para Revenda · Quantidade: 60 · Valor Total: 850,00 (o valor da venda).
        </p>
        <p>
          <b>Errou um lançamento?</b> Se você tiver permissão, clique em "Editar" na linha
          correspondente do Livro Diário — ou em "Excluir", se preferir refazer do zero.
        </p>
      </div>

      <SubSecaoTitulo numero="4.">Consulta por Conta</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        Escolha uma conta específica e veja o extrato completo dela — todos os lançamentos que a
        afetaram, com o saldo acumulado após cada um, como um extrato bancário.
      </p>
      <TabelaIlustrada
        legenda="Escolha a conta no topo da tela"
        colunas={["Data", "Histórico", "Contrapartida", "Débito", "Crédito", "Saldo Acum."]}
        badgeColuna={0}
        linhas={[
          ["—", "Saldo inicial", "—", "", "", "1.500,00"],
          ["03/08/2026", "Venda de mercadorias à vista", "4.1.1.01", "500,00", "", "2.000,00"],
        ]}
      />

      <SubSecaoTitulo numero="5.">Controle de Estoque</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        Este módulo é <b>só consulta</b> — não existe formulário para cadastrar movimentação aqui.
        O estoque é atualizado automaticamente a partir dos lançamentos: quando a conta débito ou
        crédito de um lançamento controla estoque, um campo extra Quantidade aparece em
        Lançamentos — é ele que alimenta esta tela.
      </p>
      <TabelaIlustrada
        legenda='A coluna "Movimento" é decidida sozinha: débito na conta de estoque = Entrada, crédito = Saída'
        colunas={["Data", "Movimento", "Conta", "Histórico", "Quantidade"]}
        linhas={[
          ["10/08/2026", "Entrada", "1.1.3.01", "Compra de mercadorias à vista", "100"],
          ["15/08/2026", "Saída", "1.1.3.01", "Venda de mercadorias à vista", "60"],
        ]}
      />
      <p className="text-xs text-inkSoft mb-2">
        PEPS · FIFO baixa pelo custo dos lotes mais antigos. UEPS · LIFO baixa pelo custo dos
        lotes mais recentes —{" "}
        <span className="text-red">não é aceito pela legislação fiscal brasileira</span>, aparece
        aqui só para fins comparativos. Média Ponderada recalcula o custo médio a cada entrada.
      </p>

      <SubSecaoTitulo numero="6.">Balancete de Verificação</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        Lista todas as contas com movimento no período, com seus totais de débito, crédito e
        saldo — a principal ferramenta para conferir se os lançamentos estão equilibrados.
      </p>
      <TabelaIlustrada
        legenda="Somente contas com movimento aparecem na lista"
        colunas={["Código", "Conta", "Natureza", "Tot. Débitos", "Tot. Créditos", "Saldo Dev.", "Saldo Cred."]}
        linhas={[
          ["1.1.1.01", "Caixa Geral", "Devedora", "1.500,00", "500,00", "1.000,00", ""],
          ["2.1.1.01", "Fornecedores", "Credora", "300,00", "3.000,00", "", "2.700,00"],
        ]}
      />
      <div className="flex items-center gap-3 mb-4">
        <SeloFechamento ok rotulo="Balancete" formula="D = C" />
        <p className="text-sm text-inkSoft">
          Fique de olho neste selo: ele confirma se a soma de todos os débitos bate com a soma de
          todos os créditos.
        </p>
      </div>

      <SubSecaoTitulo numero="7.">DRE (Demonstração do Resultado do Exercício)</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        Apura o resultado do período (lucro ou prejuízo) — leia de cima para baixo, cada linha
        parte do resultado da anterior.
      </p>
      <DRECascataIlustrada
        linhas={[
          ["Receita Bruta de Vendas e Serviços", "R$ 3.500,00", "normal"],
          ["(-) Deduções da Receita", "R$ 0,00", "normal"],
          ["(=) Receita Líquida", "R$ 3.500,00", "sub"],
          ["(-) Custo das Mercadorias Vendidas", "R$ 0,00", "normal"],
          ["(=) Resultado Bruto", "R$ 3.500,00", "sub"],
          ["(-) Despesas Administrativas", "R$ 0,00", "normal"],
          ["(=) Resultado Operacional", "R$ 3.500,00", "sub"],
          ["(=) RESULTADO LÍQUIDO DO EXERCÍCIO", "R$ 3.500,00", "final"],
        ]}
      />

      <SubSecaoTitulo numero="8.">Encerramento (conta ARE)</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        Ao final do período, as contas de Receita, Despesa e Custo precisam ser "zeradas" — o
        Encerramento transfere seus saldos para a conta ARE (7.1.01) e, de lá, para o Patrimônio
        Líquido.
      </p>
      <TabelaIlustrada
        legenda="O sistema sugere estes lançamentos com base nos totais apurados"
        colunas={["Conta Débito", "Conta Crédito", "Valor", "Observação"]}
        linhas={[
          ["contas 4.*", "7.1.01", "3.500,00", "Encerramento das contas de Receita"],
          ["7.1.01", "3.9", "3.500,00", "Lucro do período: PL recebe o resultado"],
        ]}
      />

      <SubSecaoTitulo numero="9.">Balanço Patrimonial</SubSecaoTitulo>
      <p className="text-sm text-inkSoft mb-3">
        Retrata a posição patrimonial numa data específica: de um lado o que a empresa possui
        (Ativo), do outro como isso foi financiado (Passivo + Patrimônio Líquido).
      </p>
      <BalancoIlustrado
        ativo={[
          ["Ativo Circulante", "R$ 4.700,00", "normal"],
          ["Ativo Não Circulante", "R$ 0,00", "normal"],
          ["TOTAL DO ATIVO", "R$ 4.700,00", "final"],
        ]}
        passivo={[
          ["Passivo Circulante", "R$ 0,00", "normal"],
          ["Patrimônio Líquido", "R$ 1.200,00", "normal"],
          ["Resultado do Exercício (DRE)", "R$ 3.500,00", "normal"],
          ["TOTAL DO PASSIVO + PL", "R$ 4.700,00", "final"],
        ]}
      />
      <div className="flex items-center gap-3">
        <SeloFechamento ok rotulo="Balanço" formula="A = P+PL" />
        <p className="text-sm text-inkSoft">
          Assim como no Balancete, esse selo confirma se o Ativo é igual ao Passivo + PL.
        </p>
      </div>
    </div>
  );
}

function ManualRelatorios() {
  const itens = [
    ["Balancete — o que significa", 'É uma ferramenta de conferência, não um relatório oficial de divulgação. Prova que o princípio das partidas dobradas foi respeitado: se o total debitado é igual ao total creditado, o Balancete "fecha". É o primeiro lugar a olhar quando algo parece errado.'],
    ["DRE — o que significa", "Responde: a empresa deu lucro ou prejuízo, e por quê? Parte da Receita Bruta e vai subtraindo, em cascata, tudo que consome essa receita, até sobrar o Resultado Líquido."],
    ["Encerramento (ARE) — o que significa", "As contas de Receita, Despesa e Custo só valem para um período — precisam voltar a zero no seguinte. O Encerramento transfere o saldo dessas contas para a conta ARE e, de lá, para o Patrimônio Líquido."],
    ["Balanço Patrimonial — o que significa", "É a fotografia da empresa num instante: tudo que ela possui (Ativo) de um lado, e de onde veio o dinheiro para ter isso (Passivo + PL) do outro. Os dois lados são sempre iguais."],
    ["Consulta por Conta — o que significa", "É o razão de uma única conta: a história completa dela, lançamento por lançamento, com saldo acumulado — serve para investigar de onde veio um valor."],
  ];
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Entendendo os relatórios</h3>
      <p className="text-sm text-inkSoft mb-4">
        A seção anterior mostrou como usar cada tela. Esta explica o que cada relatório
        significa dentro da Contabilidade.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {itens.map(([t, d]) => (
          <ConceptCard key={t} titulo={t}>{d}</ConceptCard>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <SeloFechamento ok rotulo="Balancete" formula="D = C" />
        <SeloFechamento ok rotulo="Balanço" formula="A = P+PL" />
      </div>
    </div>
  );
}

function ManualFaq() {
  const faqs = [
    ['Por que meu Balancete está "Divergente"?', 'Confira se em algum lançamento o valor foi digitado errado, ou se a conta de débito ficou igual à de crédito. Some manualmente a coluna "Total Débitos" e "Total Créditos" do Balancete para localizar a diferença.'],
    ["Sumiram meus lançamentos!", "Agora os dados ficam salvos na nuvem (Firebase) e sincronizam entre dispositivos — se você está logado com a mesma conta, eles devem aparecer. Se o problema persistir, avise um usuário Mestre."],
    ["Não encontro o botão para excluir um lançamento/empresa/usuário", 'Como Aluno, essas ações ficam bloqueadas por padrão para evitar exclusões acidentais. Peça a um usuário Mestre ou Professor para excluir o item, ou para liberar a permissão correspondente para você (módulo Usuários → botão "Permissões").'],
    ["Minha matrícula não é encontrada ao entrar", "O professor(a) precisa cadastrar seu nome e matrícula na turma antes (módulo Turmas → \"Alunos esperados\"). Sem isso, o sistema não sabe a qual turma te vincular. Avise seu professor(a) e tente de novo."],
    ["Preciso digitar a senha mestre toda vez que entro?", "Só se sua conta for do tipo Mestre — nesse caso, a senha é pedida a cada entrada, mesmo já logado pelo Google, por segurança. Aluno e Professor não veem essa tela."],
    ["Posso usar no celular?", 'Sim, o sistema se adapta a telas pequenas. Toque no botão "☰ Menu" para abrir a navegação lateral.'],
    ["Preciso estar conectado à internet?", "Sim — como os dados agora ficam salvos na nuvem, é necessário estar conectado para lançar, consultar ou ver relatórios atualizados."],
    ["Posso praticar em mais de uma empresa?", "Cada aluno tem uma empresa vinculada pelo professor(a). Se você precisar de outra, peça para ele(a) cadastrar e vincular a você no módulo Empresas."],
    ["Como o estoque é atualizado?", 'Não existe cadastro manual de estoque. Lance a compra ou venda normalmente em Lançamentos, usando uma conta marcada "Controla estoque" — o campo Quantidade que aparece alimenta o Controle de Estoque sozinho.'],
  ];
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-4">Perguntas frequentes</h3>
      <div className="space-y-3">
        {faqs.map(([q, a]) => (
          <Card key={q}>
            <h4 className="font-semibold text-ink text-sm mb-1">{q}</h4>
            <p className="text-sm text-inkSoft">{a}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ManualGlossario() {
  const termos = [
    ["Débito / Crédito", "Os dois lados de todo lançamento contábil. Não significam \"entrada\" ou \"saída\" de dinheiro — o efeito depende da natureza de cada conta."],
    ["Partidas Dobradas", "Princípio pelo qual todo fato contábil afeta pelo menos duas contas, com o mesmo valor a débito e a crédito."],
    ["Natureza da conta", "Lado (devedor ou credor) em que uma conta aumenta de saldo."],
    ["Livro Diário", "Registro cronológico de todos os lançamentos contábeis."],
    ["Razão", 'Agrupamento dos lançamentos por conta, mostrando o histórico e o saldo acumulado de cada uma — é o que o módulo "Consulta por Conta" apresenta.'],
    ["Balancete de Verificação", "Lista de todas as contas com seus totais de débito, crédito e saldo, usada para conferir se os lançamentos estão equilibrados."],
    ["Competência", "Regime que reconhece receitas e despesas no período em que ocorrem, independentemente do recebimento/pagamento."],
    ["CMV", "Custo da Mercadoria Vendida — o custo de aquisição das mercadorias que foram vendidas no período."],
    ["DRE", "Demonstração do Resultado do Exercício — relatório que apura o lucro ou prejuízo do período."],
    ["ARE", "Apuração do Resultado do Exercício — conta usada para encerrar as contas de resultado ao final do período."],
    ["Balanço Patrimonial", "Relatório que mostra a posição patrimonial (Ativo, Passivo e PL) da empresa em uma data específica."],
    ["PEPS / UEPS / MP", "Critérios de avaliação de estoque: Primeiro que Entra Primeiro que Sai, Último que Entra Primeiro que Sai, e Média Ponderada Móvel."],
    ["Turma", "Cadastro que agrupa os usuários (módulo Turmas). É obrigatório escolher uma turma já cadastrada ao criar um usuário."],
    ["Mestre", "Perfil de usuário com acesso total ao sistema, responsável por liberar ou bloquear permissões para os demais usuários."],
    ["Permissões", "Conjunto de ações que cada usuário pode ou não realizar — configuradas por um usuário Mestre no módulo Usuários."],
  ];
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-4">Glossário</h3>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3 w-56">Termo</th>
              <th className="py-2 pr-3">Significado</th>
            </tr>
          </thead>
          <tbody>
            {termos.map(([t, d]) => (
              <tr key={t} className="border-b border-line/50">
                <td className="py-1.5 pr-3 font-semibold text-ink whitespace-nowrap">{t}</td>
                <td className="py-1.5 pr-3 text-inkSoft">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ============================================================================
// MANUAL DO PROFESSOR — operacionalidade dos acessos de Mestre/Professor.
// Visível só para quem não é Aluno (ver filtro em APRENDIZADO_ITENS e na Capa).
// ============================================================================

const MANUAL_PROF_SUBS = [
  { id: "turmas", label: "Turmas" },
  { id: "empresas", label: "Empresas" },
  { id: "usuarios", label: "Usuários e Aprovações" },
  { id: "plano", label: "Plano de Contas" },
  { id: "sistema", label: "Auditoria e Backup" },
];

function ManualProfTurmas() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Gestão de Turmas</h3>
      <p className="text-sm text-inkSoft mb-4">
        A turma é o primeiro cadastro do sistema — sem ela, nenhum aluno consegue entrar.
      </p>
      <TabelaIlustrada
        legenda="Card de cada turma, com a contagem de usuários vinculados"
        colunas={["Turma", "Usuários vinculados"]}
        badgeColuna={0}
        linhas={[
          ["4741-N-1 - MÓDULO-1-CONTABILIDADE", "12 usuário(s)"],
          ["4739-N-1 - MÓDULO-1-ADMINISTRAÇÃO FINANCEIRA", "0 usuário(s)"],
        ]}
      />
      <Card className="mb-4">
        <PassoManual n={1} titulo="Cadastrar uma turma">
          Vá em <b>Turmas</b>, digite o nome (ex.: "3ª Contabilidade — Manhã") e clique em
          "Adicionar".
        </PassoManual>
        <PassoManual n={2} titulo='Cadastrar "Alunos esperados" (nome + matrícula)'>
          Clique em "Alunos esperados" no card da turma e adicione o nome completo e a matrícula
          de cada aluno. É essa lista que o sistema consulta no primeiro login de cada aluno —
          sem o registro aqui, a matrícula digitada não é encontrada.
        </PassoManual>
        <PassoManual n={3} titulo="Renomear ou excluir">
          Use os ícones de lápis (editar) e lixeira (excluir) em cada card. Uma turma com
          usuários vinculados não pode ser excluída pelo caminho normal — o sistema avisa e
          pede para mudar a turma desses usuários primeiro.
        </PassoManual>
        <PassoManual n={4} titulo='Zona de perigo: "Excluir e desvincular"'>
          Só um usuário <b>Mestre</b> vê esse link (em vermelho) quando a turma já tem usuários
          vinculados. Ele exclui a turma e desvincula todos os alunos dela de uma vez — sem
          apagar as contas deles, só tira a turma. Pede confirmação digitando o nome exato da
          turma, por ser uma ação irreversível.
        </PassoManual>
      </Card>
      <div className="text-xs text-inkSoft">
        Alunos só enxergam a própria turma nesta tela; Mestre e Professor veem todas.
      </div>
    </div>
  );
}

function ManualProfEmpresas() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Gestão de Empresas</h3>
      <p className="text-sm text-inkSoft mb-4">
        Desde a Fase 6, a empresa de cada aluno é criada <b>automaticamente</b> no primeiro
        acesso — não é mais preciso cadastrá-la manualmente. Este módulo agora serve para
        <b> consultar e ajustar</b> os dados depois.
      </p>
      <TabelaIlustrada
        legenda="O que acontece automaticamente no primeiro login do aluno"
        colunas={["Campo", "Preenchimento"]}
        badgeColuna={0}
        linhas={[
          ["Nome da empresa", '"Nome Completo do Aluno" + " LTDA" (automático)'],
          ["CNPJ", "Fica em branco — o aluno preenche depois, se a atividade pedir"],
          ["Atividade", "Fica em branco — o aluno preenche"],
          ["Aluno responsável", "Já vem vinculado automaticamente"],
        ]}
      />
      <Card className="mb-4">
        <PassoManual n={1} titulo="Criação automática">
          Quando um aluno faz o primeiro login e a matrícula é reconhecida (ver Turmas), o
          sistema já cria a empresa dele sozinho, com o nome "Nome Completo LTDA" — os demais
          campos ficam em branco.
        </PassoManual>
        <PassoManual n={2} titulo="Editar depois, se precisar">
          Clique no lápis a qualquer momento para corrigir o CNPJ, a atividade, ou reatribuir a
          empresa a outro aluno — útil em casos excepcionais.
        </PassoManual>
        <PassoManual n={3} titulo="Cadastro manual (casos especiais)">
          O formulário de cadastro continua disponível para criar uma empresa avulsa (ex.:
          empresa de demonstração, sem aluno vinculado).
        </PassoManual>
      </Card>
      <div className="text-xs text-inkSoft">
        Alunos só veem a própria empresa nesta tela e no seletor "Empresa ativa"; Mestre e
        Professor veem todas, com o nome do aluno vinculado em cada card.
      </div>
    </div>
  );
}

function ManualProfUsuarios() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Usuários e Aprovações</h3>
      <p className="text-sm text-inkSoft mb-4">
        Um Aluno(a) cuja matrícula já está cadastrada na turma (ver Turmas → "Alunos esperados")
        entra <b>direto, já aprovado</b> — o professor(a) autorizou ao cadastrar a matrícula. Já um
        Professor(a) sem Código de Mestre entra como <b>pendente</b> e precisa de aprovação.
      </p>

      <h4 className="font-semibold text-ink text-sm mb-1">Aprovações</h4>
      <p className="text-sm text-inkSoft mb-3">
        A aba "Aprovações" só aparece para quem tem a permissão correspondente, e mostra a fila de
        cadastros pendentes.
      </p>
      <Card className="mb-4">
        <PassoManual n={1} titulo="Aprovar">
          Confere nome, e-mail e turma do cadastro, e clica em "Aprovar" — a conta passa a poder
          fazer login imediatamente.
        </PassoManual>
        <PassoManual n={2} titulo="Rejeitar">
          Exclui o cadastro pendente por completo (útil para cadastros duplicados ou por engano).
        </PassoManual>
      </Card>

      <h4 className="font-semibold text-ink text-sm mb-1">Usuários</h4>
      <p className="text-sm text-inkSoft mb-3">
        Lista todas as contas já aprovadas, com tipo, turma e permissões de cada uma.
      </p>
      <Card className="mb-4">
        <PassoManual n={1} titulo="Mudar o tipo (Aluno / Professor / Mestre)">
          Escolha o novo tipo no seletor da linha do usuário. As permissões dele são
          redefinidas automaticamente para o padrão do novo tipo. Não é possível rebaixar ou
          excluir o único Mestre restante do sistema.
        </PassoManual>
        <PassoManual n={2} titulo="Mudar a turma">
          Útil quando um aluno troca de turma no meio do curso.
        </PassoManual>
        <PassoManual n={3} titulo='Botão "Permissões"'>
          Abre um painel com cada permissão individual (excluir lançamentos, excluir empresas,
          excluir usuários, gerenciar turmas e empresas, restaurar backup, ver auditoria, aprovar
          usuários) — dá para ligar ou desligar qualquer uma, além do padrão do tipo. Use para
          casos especiais, como dar a um aluno de confiança a permissão de excluir os próprios
          lançamentos errados.
        </PassoManual>
        <PassoManual n={4} titulo="Excluir">
          Remove a conta por completo (só quem tem a permissão "Excluir usuários").
        </PassoManual>
      </Card>
      <div className="text-xs text-inkSoft">
        Permissões padrão por tipo — Mestre: todas ligadas. Professor: excluir lançamentos,
        gerenciar turmas e empresas, ver auditoria. Aluno: nenhuma permissão extra por padrão.
      </div>
    </div>
  );
}

function ManualProfPlano() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Plano de Contas — edição (só Mestre)</h3>
      <p className="text-sm text-inkSoft mb-4">
        Diferente do Aluno (que só consulta), um usuário <b>Mestre</b> pode incluir, editar e
        excluir contas — com histórico de alterações registrado automaticamente.
      </p>
      <TabelaIlustrada
        legenda="Campos do formulário de conta"
        colunas={["Campo", "Observação"]}
        badgeColuna={0}
        linhas={[
          ["Código", "Sugerido automaticamente pelo Grupo + Tipo — editável"],
          ["Grupo / Tipo / Natureza", "Definem a classificação e a numeração"],
          ["Recebe lançamentos?", "Só contas analíticas/subcontas devem marcar Sim"],
          ["Controla estoque?", "Só contas físicas de mercadoria/produto"],
        ]}
      />
      <Card className="mb-4">
        <PassoManual n={1} titulo="Criar uma conta nova">
          Clique em "Nova conta". Ao escolher Grupo e Tipo, o Código já vem sugerido seguindo a
          sequência das contas existentes — pode aceitar ou digitar outro.
        </PassoManual>
        <PassoManual n={2} titulo="Editar">
          O código não pode ser alterado numa conta já existente (evita quebrar lançamentos
          antigos que já usam aquele código) — só nome, grupo, natureza etc.
        </PassoManual>
        <PassoManual n={3} titulo='Marcar "Controla estoque"'>
          Habilite só nas contas físicas de mercadoria/produto (ex.: "Mercadorias para
          Revenda"). Isso faz o campo Quantidade aparecer em Lançamentos para essa conta e
          alimenta o Controle de Estoque (PEPS/UEPS/MP) automaticamente.
        </PassoManual>
        <PassoManual n={4} titulo="Excluir">
          Avisa se a conta já foi usada em algum lançamento — os lançamentos antigos continuam
          existindo, mas passam a exibir só o código, sem nome.
        </PassoManual>
        <PassoManual n={5} titulo="Histórico de alterações">
          Aparece no fim da página: quem alterou o quê e quando, para todo o plano de contas.
        </PassoManual>
      </Card>
    </div>
  );
}

function ManualProfSistema() {
  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Auditoria e Backup</h3>

      <h4 className="font-semibold text-ink text-sm mb-1">Auditoria</h4>
      <p className="text-sm text-inkSoft mb-3">
        Todo cadastro, edição ou exclusão feito por qualquer usuário fica registrado
        automaticamente — com data/hora, quem fez e o que foi feito. Não é possível apagar essa
        lista pela interface.
      </p>
      <Card className="mb-4">
        <PassoManual n={1} titulo="Filtrar o log">
          Use os três seletores (usuário, tipo de registro, ação) para localizar uma alteração
          específica.
        </PassoManual>
        <PassoManual n={2} titulo="Exportar em CSV">
          Baixa o log completo para arquivar ou analisar no Excel.
        </PassoManual>
      </Card>
      <div className="text-xs text-inkSoft mb-4">
        Só aparece para quem tem a permissão "Ver auditoria" (Mestre e Professor, por padrão).
      </div>

      <h4 className="font-semibold text-ink text-sm mb-1">Backup</h4>
      <p className="text-sm text-inkSoft mb-3">
        Os dados já ficam salvos e sincronizados na nuvem automaticamente — este módulo serve
        para arquivar um retrato completo do sistema, ou para recuperar de uma falha grave.
      </p>
      <Card>
        <PassoManual n={1} titulo="Exportar backup completo">
          Baixa um arquivo .json com turmas, empresas, usuários, lançamentos, saldos e o log de
          auditoria de tudo — disponível para Mestre e Professor.
        </PassoManual>
        <PassoManual n={2} titulo="Restaurar backup">
          <span className="text-red">
            Atenção: restaurar substitui os dados de TODOS os usuários do sistema neste momento,
            não só os seus.
          </span>{" "}
          Use apenas em emergências. Só quem tem a permissão "Restaurar backup" (Mestre, por
          padrão) vê essa opção, e o sistema pede para digitar "RESTAURAR" antes de confirmar.
        </PassoManual>
      </Card>

      <h4 className="font-semibold text-ink text-sm mt-4 mb-1">Relatórios → Comparativo entre Empresas</h4>
      <p className="text-sm text-inkSoft">
        Só Mestre e Professor veem essa aba dentro de Relatórios — uma tabela com todas as
        empresas cadastradas, o aluno responsável de cada uma, quantidade de lançamentos, total do
        Ativo e resultado do exercício. Útil para acompanhar a turma inteira de uma vez, sem
        precisar entrar empresa por empresa.
      </p>
    </div>
  );
}

// Link para os PDFs dos manuais — arquivos estáticos servidos pelo próprio
// GitHub Pages (pasta public/manuais/ do projeto). BASE_URL respeita o
// subcaminho de publicação do site automaticamente.
function BotoesPDF({ arquivo, nome }) {
  const url = `${import.meta.env.BASE_URL}manuais/${arquivo}`;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-sm text-ink hover:border-green hover:text-green transition-colors"
      >
        <ExternalLink size={15} /> Abrir PDF em nova aba
      </a>
      <a
        href={url}
        download={nome}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green text-white text-sm hover:opacity-90 transition-opacity"
      >
        <Download size={15} /> Baixar PDF
      </a>
    </div>
  );
}

function GestaoManualProfessorView() {
  const [sub, setSub] = useState("turmas");
  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Manual do Professor</h2>
      <p className="text-sm text-inkSoft mb-3">
        Funcionalidade e operacionalidade dos acessos de Mestre/Professor — cadastro e gestão de
        turmas, empresas, usuários, plano de contas, auditoria e backup.
      </p>
      <BotoesPDF arquivo="Manual_do_Professor.pdf" nome="Manual do Professor.pdf" />
      <SubNav itens={MANUAL_PROF_SUBS} atual={sub} aoTrocar={setSub} />
      {sub === "turmas" && <ManualProfTurmas />}
      {sub === "empresas" && <ManualProfEmpresas />}
      {sub === "usuarios" && <ManualProfUsuarios />}
      {sub === "plano" && <ManualProfPlano />}
      {sub === "sistema" && <ManualProfSistema />}
    </div>
  );
}

// Documento técnico do Administrador — o conteúdo detalhado (fluxo de
// publicação, estrutura de pastas, segurança de acesso) mora no PDF; aqui
// fica um resumo rápido de orientação + os botões de abrir/baixar.
function GestaoManualOperacionalizacaoView() {
  const secoes = [
    ["1. Operacionalização — Quem Faz o Quê", "Claude escreve o código → GitHub publica o site → Firebase guarda e sincroniza os dados."],
    ["2. Estrutura de Pastas do Projeto", "src/ para código, public/manuais/ para os PDFs."],
    ["3. Publicando Atualizações", "Caminho A (editar 1 arquivo pelo site) ou Caminho B (GitHub Desktop, para pastas/múltiplos arquivos)."],
    ["4. Conferir a Publicação (Actions)", "Sempre confirme o ✓ verde antes de considerar a tarefa concluída."],
    ["5. Login e Segurança de Acesso", "Habilitar Google no Firebase, autorizar o domínio, trocar a senha mestre."],
    ["6. Central de Suporte — Visão do Administrador", "Ver e gerenciar status dos chamados Sistema e Suporte Pedagógico."],
    ["7. Importação de Turmas via PDF", "Como funciona o reconhecimento automático de nome + matrícula."],
    ["8. Cuidados Importantes", "OneDrive, upload de pastas, conferir caminho antes de comitar, repositório certo."],
  ];
  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Manual de Operacionalização do Sistema</h2>
      <p className="text-sm text-inkSoft mb-3">
        Documento específico para o Administrador (Mestre): orientações sobre utilização,
        configuração, gerenciamento e operacionalização das funcionalidades do sistema.
      </p>
      <BotoesPDF arquivo="Manual_de_Operacionalizacao.pdf" nome="Manual de Operacionalização.pdf" />
      <Card>
        <div className="text-xs text-inkSoft uppercase tracking-wide mb-2">O que tem no PDF</div>
        <div className="space-y-3">
          {secoes.map(([t, d]) => (
            <div key={t}>
              <div className="font-semibold text-ink text-sm">{t}</div>
              <div className="text-sm text-inkSoft">{d}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Checklist "vivo" do projeto — visão rápida em tela, com o PDF completo
// (prioridade × complexidade, ordem recomendada) disponível para consulta e
// arquivamento. Atualize pedindo ao Claude sempre que algo mudar de status.
function GestaoChecklistDevView() {
  const concluidos = [
    "Fases 1 a 5 completas (ciclo contábil, turmas, empresas, usuários, auditoria, relatórios, backup)",
    "Plano de Contas editável com histórico",
    "Controle de Estoque automático via Lançamentos",
    "Manual do Aluno e Manual do Professor no sistema",
    "Login com Google (Aluno e Professor)",
    "Matrícula do Aluno vinculada à turma",
    "Senha mestre a cada entrada",
    "Central de Suporte (Sistema e Suporte Pedagógico)",
    "Importação de turmas via PDF",
    "Manual de Operacionalização do Sistema",
  ];
  const pendentesTop5 = [
    ["Publicar PDFs atualizados em public/manuais/", "Alta", "Baixa"],
    ["Confirmar login com Google em produção", "Alta", "Baixa"],
    ["Testar Backup — Exportar e Restaurar", "Alta", "Baixa"],
    ["Testar fluxo completo de matrícula com aluno real", "Alta", "Baixa"],
    ["Testar zona de perigo (excluir turma em cascata)", "Média", "Baixa"],
  ];
  const corPrioridade = { Alta: "text-red", Média: "text-gold", Baixa: "text-green" };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Checklist de Desenvolvimento e Implementação</h2>
      <p className="text-sm text-inkSoft mb-3">
        Concluído, em desenvolvimento e pendências — com prioridade, complexidade e ordem
        recomendada. Atualizado continuamente; a versão completa está sempre no PDF.
      </p>
      <BotoesPDF arquivo="Checklist_Desenvolvimento.pdf" nome="Checklist de Desenvolvimento.pdf" />

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs text-inkSoft uppercase tracking-wide mb-2">✓ Concluído (resumo)</div>
          <ul className="space-y-1.5 text-sm text-ink">
            {concluidos.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-green shrink-0">✓</span> {c}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="text-xs text-inkSoft uppercase tracking-wide mb-2">Próximos 5 (por ordem recomendada)</div>
          <ol className="space-y-2 text-sm">
            {pendentesTop5.map(([item, prioridade, complexidade], i) => (
              <li key={item}>
                <div className="text-ink">
                  <b>{i + 1}.</b> {item}
                </div>
                <div className="text-xs text-inkSoft">
                  Prioridade: <span className={`font-semibold ${corPrioridade[prioridade]}`}>{prioridade}</span> ·
                  {" "}Complexidade: <b>{complexidade}</b>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <div className="text-xs text-inkSoft mt-3">
        Lista completa (todas as pendências, seção "Em desenvolvimento" e ordem recomendada
        inteira) disponível no PDF acima.
      </div>
    </div>
  );
}

function GestaoManualView() {
  const [sub, setSub] = useState("acesso");
  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Manual do Aluno</h2>
      <BotoesPDF arquivo="Manual_do_Aluno.pdf" nome="Manual do Aluno.pdf" />
      <SubNav itens={MANUAL_SUBS} atual={sub} aoTrocar={setSub} />
      {sub === "acesso" && <ManualAcesso />}
      {sub === "ciclo" && <ManualCicloContabil />}
      {sub === "relatoriosdica" && <ManualRelatorios />}
      {sub === "faq" && <ManualFaq />}
      {sub === "glossario" && <ManualGlossario />}
    </div>
  );
}

// ============================================================================
// FASE 5 — Auditoria, Relatórios e Backup. Fecha o plano de migração.
// ============================================================================

function AcaoPill({ acao }) {
  const tons = { criar: "green", editar: "gold", excluir: "red" };
  const labels = { criar: "Criação", editar: "Edição", excluir: "Exclusão" };
  return <Pill tone={tons[acao] || "green"}>{labels[acao] || acao}</Pill>;
}

// ---- Auditoria ----

function GestaoAuditoriaView({ perfil, auditoria }) {
  const podeVer = !!perfil?.permissoes?.verAuditoria;
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroEntidade, setFiltroEntidade] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");

  if (!podeVer) {
    return (
      <div className="text-sm text-inkSoft italic">
        Você não tem permissão para ver o log de Auditoria. Peça a um usuário <b>Mestre</b> ou{" "}
        <b>Professor</b> para consultar ou liberar essa permissão para você.
      </div>
    );
  }

  const log = auditoria || [];
  const usuariosNoLog = [...new Set(log.map((l) => l.usuarioNome))].filter(Boolean).sort();
  const entidadesNoLog = [...new Set(log.map((l) => l.entidade))].filter(Boolean).sort();

  const linhas = log
    .filter((l) => !filtroUsuario || l.usuarioNome === filtroUsuario)
    .filter((l) => !filtroEntidade || l.entidade === filtroEntidade)
    .filter((l) => !filtroAcao || l.acao === filtroAcao)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp);

  const nExclusoes = log.filter((l) => l.acao === "excluir").length;

  const exportarCSV = () => {
    const linhasCSV = [["Data/Hora", "Usuário", "Entidade", "Ação", "Descrição"]];
    log
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((l) => linhasCSV.push([fmtDateTime(l.timestamp), l.usuarioNome || "", l.entidade, l.acao, l.descricao]));
    downloadCSV(`log_auditoria_${new Date().toISOString().slice(0, 10)}.csv`, linhasCSV);
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Auditoria</h2>
      <p className="text-sm text-inkSoft mb-4">
        Todo cadastro, edição ou exclusão feito no sistema fica registrado aqui automaticamente, com
        data/hora, usuário e descrição — e não pode ser apagado pela interface.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card><div className="text-xs text-inkSoft">Total de registros</div><div className="text-xl font-serif font-semibold text-ink">{log.length}</div></Card>
        <Card><div className="text-xs text-inkSoft">Exclusões registradas</div><div className={"text-xl font-serif font-semibold " + (nExclusoes ? "text-red" : "text-ink")}>{nExclusoes}</div></Card>
        <Card><div className="text-xs text-inkSoft">Usuários com atividade</div><div className="text-xl font-serif font-semibold text-ink">{usuariosNoLog.length}</div></Card>
        <Card><div className="text-xs text-inkSoft">Tipos de registro</div><div className="text-xl font-serif font-semibold text-ink">{entidadesNoLog.length}</div></Card>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <SelectInput value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} className="sm:max-w-[200px]">
            <option value="">Todos os usuários</option>
            {usuariosNoLog.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </SelectInput>
          <SelectInput value={filtroEntidade} onChange={(e) => setFiltroEntidade(e.target.value)} className="sm:max-w-[180px]">
            <option value="">Todos os tipos</option>
            {entidadesNoLog.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </SelectInput>
          <SelectInput value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)} className="sm:max-w-[160px]">
            <option value="">Todas as ações</option>
            <option value="criar">Criação</option>
            <option value="editar">Edição</option>
            <option value="excluir">Exclusão</option>
          </SelectInput>
          <Botao variant="ghost" onClick={exportarCSV}>Exportar log (CSV)</Botao>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Data/Hora</th>
              <th className="py-2 pr-3">Usuário</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Ação</th>
              <th className="py-2 pr-3">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-line/50 align-top">
                <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDateTime(l.timestamp)}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap">{l.usuarioNome || "—"}</td>
                <td className="py-1.5 pr-3">{l.entidade}</td>
                <td className="py-1.5 pr-3"><AcaoPill acao={l.acao} /></td>
                <td className="py-1.5 pr-3">{l.descricao}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-inkSoft italic">
                  Nenhum registro encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <div className="text-xs text-inkSoft mt-3">
        Para não crescer indefinidamente, este log mantém apenas os <b>1.000 registros mais
        recentes</b> — os mais antigos são descartados automaticamente à medida que novos são
        criados.
      </div>
    </div>
  );
}

// ---- Relatórios ----

const RELAT_SUBS = [
  { id: "resumo", label: "Resumo da Empresa" },
  { id: "comparativo", label: "Comparativo entre Empresas" },
  { id: "exportar", label: "Exportar / Imprimir" },
];

// Busca lançamentos + saldos de UMA empresa direto do Firestore (usado para
// montar o Comparativo e o Backup, que precisam de todas as empresas de uma
// vez — não só da empresa ativa selecionada no momento).
async function buscarDadosEmpresa(empresaId) {
  let lancamentos = [], saldos = {};
  try {
    const r = await window.storage.get(`lancamentos_${empresaId}`, true);
    lancamentos = r ? JSON.parse(r.value) : [];
  } catch {}
  try {
    const r = await window.storage.get(`saldos_${empresaId}`, true);
    saldos = r ? JSON.parse(r.value) : {};
  } catch {}
  return { lancamentos, saldos };
}

function RelatorioResumo({ empresa, lancamentos, saldos, leaves, contaByCode }) {
  if (!empresa) return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima.</div>;

  const dre = computeDRE(lancamentos, saldos);
  const ativoCirc = debMinusCredPrefix(lancamentos, saldos, "1.1");
  const ativoNaoCirc = debMinusCredPrefix(lancamentos, saldos, "1.2");
  const totalAtivo = ativoCirc + ativoNaoCirc;
  const passivoCirc = credMinusDebPrefix(lancamentos, saldos, "2.1");
  const passivoNaoCirc = credMinusDebPrefix(lancamentos, saldos, "2.2");
  const pl = credMinusDebPrefix(lancamentos, saldos, "3");
  const totalPassivoPL = passivoCirc + passivoNaoCirc + pl + dre.resultadoLiquido;
  const okBP = Math.abs(totalAtivo - totalPassivoPL) < 0.005;

  let totDeb = 0, totCred = 0;
  leaves.forEach((c) => {
    const s = saldoConta(lancamentos, saldos, contaByCode, c.codigo);
    totDeb += s.deb; totCred += s.cred;
  });
  const okBal = Math.abs(totDeb - totCred) < 0.005;

  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Resumo — {empresa.nome}</h3>
      <p className="text-sm text-inkSoft mb-4">
        Painel consolidado com os principais indicadores apurados a partir dos lançamentos e saldos
        iniciais desta empresa.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><div className="text-xs text-inkSoft">Lançamentos no período</div><div className="text-xl font-serif font-semibold text-ink">{(lancamentos || []).length}</div></Card>
        <Card><div className="text-xs text-inkSoft">Total do Ativo</div><div className="text-xl font-serif font-semibold text-ink">{money(totalAtivo)}</div></Card>
        <Card><div className="text-xs text-inkSoft">Receita Bruta</div><div className="text-xl font-serif font-semibold text-green">{money(dre.receitaBruta)}</div></Card>
        <Card><div className="text-xs text-inkSoft">Resultado do Exercício</div><div className={"text-xl font-serif font-semibold " + (dre.resultadoLiquido >= 0 ? "text-green" : "text-red")}>{money(dre.resultadoLiquido)}</div></Card>
        <Card><div className="text-xs text-inkSoft">Situação do Balancete</div><div className={"text-xl font-serif font-semibold " + (okBal ? "text-green" : "text-red")}>{okBal ? "Fechado" : "Divergente"}</div></Card>
        <Card><div className="text-xs text-inkSoft">Situação do Balanço</div><div className={"text-xl font-serif font-semibold " + (okBP ? "text-green" : "text-red")}>{okBP ? "Fechado" : "Divergente"}</div></Card>
      </div>
      <div className="text-xs text-inkSoft mt-4">
        Para o detalhamento completo, consulte os módulos Balancete, DRE, Encerramento e Balanço
        Patrimonial. Use a aba <b>Exportar / Imprimir</b> para gerar uma versão em PDF ou planilha.
      </div>
    </div>
  );
}

function RelatorioComparativo({ empresas, empresaAtivaId }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const lista = empresas || [];
    const resultado = await Promise.all(
      lista.map(async (em) => {
        const { lancamentos, saldos } = await buscarDadosEmpresa(em.id);
        const ativo = debMinusCredPrefix(lancamentos, saldos, "1.1") + debMinusCredPrefix(lancamentos, saldos, "1.2");
        const dre = computeDRE(lancamentos, saldos);
        return { empresa: em, nLanc: (lancamentos || []).length, ativo, resultado: dre.resultadoLiquido };
      })
    );
    setDados(resultado);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">Comparativo entre Empresas</h3>
      <p className="text-sm text-inkSoft mb-4">
        Visão geral de todas as empresas cadastradas — útil para acompanhar várias turmas ou
        empresas ao mesmo tempo.
      </p>
      <Card className="mb-3">
        <Botao variant="ghost" onClick={carregar} disabled={carregando}>
          {carregando ? "Atualizando…" : "Atualizar dados"}
        </Botao>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkSoft border-b border-line">
              <th className="py-2 pr-3">Empresa</th>
              <th className="py-2 pr-3">Aluno responsável</th>
              <th className="py-2 pr-3 text-right">Lançamentos</th>
              <th className="py-2 pr-3 text-right">Total do Ativo</th>
              <th className="py-2 pr-3 text-right">Resultado do Exercício</th>
            </tr>
          </thead>
          <tbody>
            {carregando && !dados && (
              <tr><td colSpan={5} className="py-4 text-center text-inkSoft italic">Carregando…</td></tr>
            )}
            {dados && dados.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-inkSoft italic">Nenhuma empresa cadastrada.</td></tr>
            )}
            {dados && dados.map(({ empresa, nLanc, ativo, resultado }) => (
              <tr key={empresa.id} className="border-b border-line/50">
                <td className="py-1.5 pr-3">
                  {empresa.nome} {empresa.id === empresaAtivaId && <Pill tone="gold">ativa</Pill>}
                </td>
                <td className="py-1.5 pr-3 text-inkSoft">{empresa.responsavel || "—"}</td>
                <td className="py-1.5 pr-3 text-right">{nLanc}</td>
                <td className="py-1.5 pr-3 text-right">{money(ativo)}</td>
                <td className={"py-1.5 pr-3 text-right " + (resultado >= 0 ? "text-green" : "text-red")}>{money(resultado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function RelatorioExportar({ empresa, lancamentos, saldos, leaves, contaByCode }) {
  const exportarDiario = () => {
    if (!empresa) return;
    const rows = [["Data", "Tipo de Operação", "Histórico", "Conta Débito", "Nome Débito", "Conta Crédito", "Nome Crédito", "Valor", "Documento", "Observações"]];
    (lancamentos || []).forEach((l) => {
      const cd = contaByCode[l.contaDebito], cc = contaByCode[l.contaCredito];
      rows.push([fmtDate(l.data), l.tipoOperacao || "", l.historico, l.contaDebito, cd ? cd.nome : "", l.contaCredito, cc ? cc.nome : "", numFmt(l.valor), l.documento || "", l.observacoes || ""]);
    });
    downloadCSV(`livro_diario_${slug(empresa.nome)}.csv`, rows);
  };

  const exportarBalancete = () => {
    if (!empresa) return;
    const rows = [["Código", "Conta", "Natureza", "Total Débitos", "Total Créditos", "Saldo Devedor", "Saldo Credor"]];
    leaves.forEach((c) => {
      const s = saldoConta(lancamentos, saldos, contaByCode, c.codigo);
      if (s.deb !== 0 || s.cred !== 0) rows.push([c.codigo, c.nome, c.natureza, numFmt(s.deb), numFmt(s.cred), s.dev ? numFmt(s.dev) : "", s.cre ? numFmt(s.cre) : ""]);
    });
    downloadCSV(`balancete_${slug(empresa.nome)}.csv`, rows);
  };

  const imprimir = () => {
    if (!empresa) return;
    window.print();
  };

  return (
    <div>
      <h3 className="font-serif font-semibold text-ink text-lg mb-1">
        Exportar e Imprimir {empresa ? `— ${empresa.nome}` : ""}
      </h3>
      <p className="text-sm text-inkSoft mb-4">
        Baixe os dados em CSV para abrir no Excel, ou use o comando de impressão do navegador (e
        escolha "Salvar como PDF" no destino) para uma versão em PDF da tela atual.
      </p>
      <Card>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={imprimir} disabled={!empresa}>Imprimir esta tela (ou salvar como PDF)</Botao>
          <Botao variant="ghost" onClick={exportarDiario} disabled={!empresa}>Baixar Livro Diário (CSV)</Botao>
          <Botao variant="ghost" onClick={exportarBalancete} disabled={!empresa}>Baixar Balancete (CSV)</Botao>
        </div>
      </Card>
      <div className="text-xs text-inkSoft mt-3">
        Os arquivos CSV usam ponto e vírgula como separador, compatível com o Excel em português.
        Para imprimir o Balancete, a DRE ou o Balanço completos, abra o módulo correspondente e use
        o comando de impressão do navegador diretamente nele.
      </div>
    </div>
  );
}

function GestaoRelatoriosView({ perfil, empresa, empresaAtivaId, lancamentos, saldos, leaves, contaByCode, empresasParaComparar }) {
  const [sub, setSub] = useState("resumo");
  const podeComparar = perfil?.tipo === "Mestre" || perfil?.tipo === "Professor";
  const subs = podeComparar ? RELAT_SUBS : RELAT_SUBS.filter((s) => s.id !== "comparativo");

  return (
    <div>
      <SubNav itens={subs} atual={sub} aoTrocar={setSub} />
      {sub === "resumo" && <RelatorioResumo empresa={empresa} lancamentos={lancamentos} saldos={saldos} leaves={leaves} contaByCode={contaByCode} />}
      {sub === "comparativo" && podeComparar && (
        <RelatorioComparativo empresas={empresasParaComparar} empresaAtivaId={empresaAtivaId} />
      )}
      {sub === "exportar" && (
        <RelatorioExportar empresa={empresa} lancamentos={lancamentos} saldos={saldos} leaves={leaves} contaByCode={contaByCode} />
      )}
    </div>
  );
}

// ---- Backup ----
// Diferente da versão antiga (localStorage, por aparelho): agora os dados já
// vivem na nuvem e sincronizam sozinhos entre todo mundo. Este módulo serve
// para arquivar um retrato do sistema inteiro (ex.: entregar ao professor, ou
// guardar antes de uma mudança grande) e, se necessário, restaurar esse
// retrato — o que SUBSTITUI os dados de TODOS os usuários, não só os seus.

function GestaoBackupView({ perfil, turmas, empresas, usuarios, auditoria, registrarAuditoria }) {
  const podeExportar = perfil?.tipo === "Mestre" || perfil?.tipo === "Professor";
  const podeRestaurar = !!perfil?.permissoes?.restaurarBackup;
  const [gerando, setGerando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const fileInputRef = useRef(null);

  if (!podeExportar) {
    return (
      <div className="text-sm text-inkSoft italic">
        Você não tem permissão para acessar o Backup. Peça a um usuário <b>Mestre</b> ou{" "}
        <b>Professor</b>.
      </div>
    );
  }

  const exportarBackup = async () => {
    setGerando(true);
    try {
      const lista = empresas || [];
      const porEmpresa = await Promise.all(
        lista.map(async (em) => ({ id: em.id, ...(await buscarDadosEmpresa(em.id)) }))
      );
      const lancamentosPorEmpresa = {};
      const saldosPorEmpresa = {};
      porEmpresa.forEach((e) => {
        lancamentosPorEmpresa[e.id] = e.lancamentos;
        saldosPorEmpresa[e.id] = e.saldos;
      });
      const backup = {
        tipo: "backup-sistema-contabil-react",
        versao: 1,
        exportadoEm: new Date().toISOString(),
        turmas: turmas || [],
        empresas: lista,
        usuarios: usuarios || [],
        lancamentosPorEmpresa,
        saldosPorEmpresa,
        auditoria: auditoria || [],
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_sistema_contabil_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await registrarAuditoria("criar", "sistema", "Gerou um backup completo do sistema");
    } finally {
      setGerando(false);
    }
  };

  const triggerImport = () => fileInputRef.current?.click();

  const handleImport = (e) => {
    if (!podeRestaurar) {
      alert("Você não tem permissão para restaurar backups.");
      e.target.value = "";
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      let data;
      try {
        data = JSON.parse(ev.target.result);
      } catch {
        alert("Não foi possível ler este arquivo. Verifique se é um backup válido gerado por este sistema.");
        e.target.value = "";
        return;
      }
      if (!data || !Array.isArray(data.usuarios) || !Array.isArray(data.empresas)) {
        alert("Este arquivo não parece ser um backup válido do Sistema de Escrituração Contábil.");
        e.target.value = "";
        return;
      }
      const resumo = `${data.usuarios.length} usuário(s), ${data.empresas.length} empresa(s)` + (data.exportadoEm ? `, gerado em ${new Date(data.exportadoEm).toLocaleString("pt-BR")}` : "");
      const digitado = prompt(
        `ATENÇÃO: restaurar este backup (${resumo}) vai SUBSTITUIR os dados de TODOS os usuários do sistema neste momento — não só os seus. Esta ação não pode ser desfeita.\n\nPara confirmar, digite RESTAURAR (em maiúsculas):`
      );
      if (digitado !== "RESTAURAR") {
        alert("Restauração cancelada.");
        e.target.value = "";
        return;
      }
      setRestaurando(true);
      try {
        await window.storage.set("turmas", JSON.stringify(data.turmas || []), true);
        await window.storage.set("empresas", JSON.stringify(data.empresas || []), true);
        for (const u of data.usuarios || []) {
          await window.storage.set(`usuario_${u.uid}`, JSON.stringify(u), true);
        }
        for (const empId of Object.keys(data.lancamentosPorEmpresa || {})) {
          await window.storage.set(`lancamentos_${empId}`, JSON.stringify(data.lancamentosPorEmpresa[empId] || []), true);
        }
        for (const empId of Object.keys(data.saldosPorEmpresa || {})) {
          await window.storage.set(`saldos_${empId}`, JSON.stringify(data.saldosPorEmpresa[empId] || {}), true);
        }
        await registrarAuditoria("editar", "sistema", `Restaurou um backup (${resumo})`);
        alert("Backup restaurado com sucesso. A página vai recarregar para atualizar todos os dados.");
        window.location.reload();
      } finally {
        setRestaurando(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Backup</h2>
      <p className="text-sm text-inkSoft mb-4">
        Os dados do sistema já ficam salvos e sincronizados automaticamente na nuvem — diferente da
        versão antiga, não é mais preciso baixar um backup só para não perder o trabalho. Use este
        módulo para arquivar um retrato completo (ex.: entregar ao final do semestre) ou para
        restaurar o sistema em caso de emergência.
      </p>

      <Card className="mb-4">
        <h3 className="font-serif font-semibold text-ink mb-2">Exportar backup completo</h3>
        <p className="text-sm text-inkSoft mb-3">
          Gera um arquivo único (.json) com tudo — turmas, empresas, usuários, lançamentos, saldos
          iniciais, estoque e o log de auditoria.
        </p>
        <Botao onClick={exportarBackup} disabled={gerando}>
          {gerando ? "Gerando…" : "Baixar backup completo"}
        </Botao>
      </Card>

      <Card>
        <h3 className="font-serif font-semibold text-ink mb-2">Restaurar backup</h3>
        <p className="text-sm text-red mb-3">
          <b>Atenção:</b> restaurar um backup substitui os dados de TODOS os usuários do sistema
          neste momento, não só os seus — use apenas em emergências (ex.: recuperar de uma falha).
        </p>
        {podeRestaurar ? (
          <>
            <Botao variant="danger" onClick={triggerImport} disabled={restaurando}>
              {restaurando ? "Restaurando…" : "Selecionar arquivo de backup para restaurar"}
            </Botao>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </>
        ) : (
          <div className="text-sm text-inkSoft">
            Você não tem permissão para restaurar backups. Peça a um usuário <b>Mestre</b>.
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// NOTAS — avaliação do professor(a) por módulo do ciclo contábil, por aluno.
// Lista compartilhada (kv: "notas"); Professor/Mestre lançam, Aluno só vê as
// próprias. Média calculada automaticamente a partir dos módulos avaliados.
// ============================================================================

// ============================================================================
// ATIVIDADES AVALIATIVAS — questões objetivas (múltipla escolha e V/F),
// corrigidas automaticamente, com nota (0,0 a 10,0) gravada no módulo de
// Notas do aluno. Aparecem no fim de Introdução à Contabilidade, Plano de
// Contas, Controle de Estoque, Balancete e DRE.
// ============================================================================

const BANCO_ATIVIDADES = {
  introducao: [
    { tipo: "vf", enunciado: "Pelo Princípio da Entidade, o patrimônio da empresa se confunde com o patrimônio pessoal dos seus sócios.", correta: false },
    { tipo: "multipla", enunciado: "Qual princípio contábil pressupõe que a empresa continuará em operação por prazo indeterminado, salvo evidência em contrário?", opcoes: ["Entidade", "Continuidade", "Oportunidade", "Prudência"], correta: 1 },
    { tipo: "vf", enunciado: "Pelo Princípio da Oportunidade, os fatos contábeis devem ser reconhecidos no momento em que ocorrem, de forma tempestiva e completa.", correta: true },
    { tipo: "multipla", enunciado: "Diante de incerteza entre duas alternativas de mensuração, qual princípio orienta a adotar o menor valor para ativos e o maior para passivos/despesas?", opcoes: ["Competência", "Registro pelo Valor Original", "Prudência (Conservadorismo)", "Continuidade"], correta: 2 },
    { tipo: "vf", enunciado: "Pelo Regime de Competência, receitas e despesas são reconhecidas no período em que são recebidas ou pagas, e não em que ocorrem.", correta: false },
    { tipo: "multipla", enunciado: "No Balanço Patrimonial, em qual grupo ficam os bens e direitos que a empresa espera realizar (converter em dinheiro) em até 12 meses?", opcoes: ["Ativo Não Circulante", "Passivo Circulante", "Ativo Circulante", "Patrimônio Líquido"], correta: 2 },
    { tipo: "multipla", enunciado: "O Patrimônio Líquido representa:", opcoes: ["As dívidas da empresa com terceiros", "Os recursos próprios dos sócios investidos na empresa", "O total de mercadorias em estoque", "O lucro bruto do período"], correta: 1 },
    { tipo: "vf", enunciado: "Pelo Princípio do Registro pelo Valor Original, os elementos patrimoniais são registrados pelos valores de entrada, podendo sofrer atualizações posteriores previstas em normas específicas.", correta: true },
  ],
  "plano-contas": [
    { tipo: "multipla", enunciado: "Uma conta do grupo Ativo, com natureza Devedora, tem seu saldo aumentado por lançamentos:", opcoes: ["A crédito", "A débito", "De encerramento", "Não sofre alteração"], correta: 1 },
    { tipo: "vf", enunciado: "Contas classificadas como “Grupo” ou “Subgrupo” (níveis mais altos da hierarquia) recebem lançamento diretamente, assim como as contas analíticas.", correta: false },
    { tipo: "multipla", enunciado: "A conta “Caixa Geral” pertence a qual grupo do plano de contas?", opcoes: ["Passivo", "Patrimônio Líquido", "Ativo", "Resultado"], correta: 2 },
    { tipo: "multipla", enunciado: "Qual é a natureza (lado que aumenta o saldo) típica de uma conta do Passivo, como “Fornecedores”?", opcoes: ["Devedora", "Credora", "Mista", "Não tem natureza"], correta: 1 },
    { tipo: "vf", enunciado: "O plano de contas do sistema é único e compartilhado por todas as empresas cadastradas.", correta: true },
    { tipo: "multipla", enunciado: "Contas do grupo 4 (Receitas) têm natureza:", opcoes: ["Devedora", "Credora", "Neutra", "Depende do lançamento"], correta: 1 },
  ],
  estoque: [
    { tipo: "multipla", enunciado: "No critério PEPS (FIFO), as saídas do estoque são baixadas pelo custo:", opcoes: ["Dos lotes mais recentes", "Dos lotes mais antigos", "Médio de todo o estoque", "De reposição futuro"], correta: 1 },
    { tipo: "vf", enunciado: "O critério UEPS (LIFO) é aceito pela legislação fiscal brasileira e pelo CPC 16 / NBC TG 16.", correta: false },
    { tipo: "multipla", enunciado: "Na Média Ponderada Móvel, o custo unitário do estoque é recalculado:", opcoes: ["A cada saída", "Só no fim do período", "A cada nova entrada", "Nunca é recalculado"], correta: 2 },
    { tipo: "vf", enunciado: "No sistema, o Controle de Estoque é atualizado automaticamente a partir dos Lançamentos — não existe cadastro manual de movimentação.", correta: true },
    { tipo: "multipla", enunciado: "Em cenários de preços em alta, qual critério tende a gerar o menor CMV (Custo da Mercadoria Vendida)?", opcoes: ["UEPS", "PEPS", "Os dois geram o mesmo CMV sempre", "Média Ponderada sempre gera o menor"], correta: 1 },
    { tipo: "multipla", enunciado: "Para uma conta de estoque ser controlada pelo sistema (PEPS/UEPS/MP), ela precisa estar marcada, no Plano de Contas, com a opção:", opcoes: ["Recebe lançamentos", "Controla estoque", "Conta Analítica", "Natureza Devedora"], correta: 1 },
  ],
  balancete: [
    { tipo: "multipla", enunciado: "O Balancete de Verificação serve principalmente para:", opcoes: ["Apurar o lucro do período", "Conferir se o total de débitos bate com o total de créditos", "Substituir a DRE", "Calcular o CMV"], correta: 1 },
    { tipo: "vf", enunciado: "Se o Balancete mostrar o selo “Divergente”, isso indica que algum lançamento está com valores diferentes entre débito e crédito.", correta: true },
    { tipo: "multipla", enunciado: "O Balancete de Verificação é:", opcoes: ["Um relatório oficial de divulgação externa", "Uma ferramenta interna de conferência do princípio das partidas dobradas", "Obrigatório apenas para empresas de grande porte", "O mesmo que o Balanço Patrimonial"], correta: 1 },
    { tipo: "vf", enunciado: "Somente contas com movimento no período aparecem listadas no Balancete.", correta: true },
    { tipo: "multipla", enunciado: "Se o total de débitos do Balancete for diferente do total de créditos, o próximo passo recomendado é:", opcoes: ["Ignorar e seguir para o Balanço", "Revisar os lançamentos até encontrar a diferença", "Excluir todas as contas", "Recriar a empresa do zero"], correta: 1 },
  ],
  dre: [
    { tipo: "multipla", enunciado: "A DRE parte de qual valor no topo da demonstração?", opcoes: ["Resultado Líquido do Exercício", "Receita Bruta de Vendas e Serviços", "Patrimônio Líquido", "Total do Ativo"], correta: 1 },
    { tipo: "vf", enunciado: "O Resultado Líquido do Exercício, calculado na DRE, aparece novamente no Balanço Patrimonial, do lado do Passivo + Patrimônio Líquido.", correta: true },
    { tipo: "multipla", enunciado: "Na DRE, o Custo da Mercadoria Vendida (CMV) é subtraído de qual valor para chegar ao Resultado Bruto?", opcoes: ["Receita Bruta", "Receita Líquida", "Resultado Operacional", "Patrimônio Líquido"], correta: 1 },
    { tipo: "vf", enunciado: "A DRE é calculada manualmente pelo aluno e precisa ser digitada linha por linha no sistema.", correta: false },
    { tipo: "multipla", enunciado: "Se a Receita Líquida for R$ 3.500,00 e não houver Custo da Mercadoria Vendida nem despesas, qual será o Resultado Líquido do Exercício?", opcoes: ["R$ 0,00", "R$ 3.500,00", "Depende do Balanço Patrimonial", "Não é possível calcular"], correta: 1 },
  ],
};

// ---- Avaliações V2 (Fase 6 — piloto) ----------------------------------
// Modelo novo: 3 exercícios de 10 questões por módulo + banco próprio de 30
// questões para a Recuperação Paralela (que substitui a MÉDIA dos 3
// exercícios, não só o mais fraco). Começando pelo piloto em Plano de
// Contas — os demais módulos (Introdução, Estoque, Balancete, DRE)
// continuam no modelo antigo (BANCO_ATIVIDADES, 1 atividade só) até serem
// migrados também.
const AVALIACOES_V2 = {
  "plano-contas": {
    exercicios: [
      // Exercício 1 — conceitos básicos (grupo, natureza)
      [
        { tipo: "vf", enunciado: "Contas do grupo Ativo têm natureza Devedora — seu saldo aumenta com lançamentos a débito.", correta: true },
        { tipo: "multipla", enunciado: "O grupo Passivo tem seu saldo aumentado por lançamentos:", opcoes: ["A débito", "A crédito", "Só no encerramento", "Nunca aumenta"], correta: 1 },
        { tipo: "vf", enunciado: "Contas do grupo Receitas têm natureza Credora.", correta: true },
        { tipo: "multipla", enunciado: "Contas de Despesas e Custos têm, tipicamente, natureza:", opcoes: ["Credora", "Devedora", "Mista", "Não têm natureza"], correta: 1 },
        { tipo: "multipla", enunciado: "A conta “Caixa Geral” pertence a qual grupo do plano de contas?", opcoes: ["Passivo", "Patrimônio Líquido", "Ativo", "Receita"], correta: 2 },
        { tipo: "vf", enunciado: "“Duplicatas a Pagar” é uma conta de natureza Credora, do grupo Passivo.", correta: true },
        { tipo: "multipla", enunciado: "Entre as contas a seguir, qual tem natureza Credora?", opcoes: ["Caixa Geral", "Estoque de Mercadorias", "Duplicatas a Pagar", "Despesas com Aluguel"], correta: 2 },
        { tipo: "vf", enunciado: "O Patrimônio Líquido representa dívidas da empresa com terceiros (fornecedores, bancos etc.).", correta: false },
        { tipo: "multipla", enunciado: "Um lançamento a crédito numa conta de natureza Credora tem o efeito de:", opcoes: ["Diminuir o saldo", "Aumentar o saldo", "Zerar o saldo", "Não afeta o saldo"], correta: 1 },
        { tipo: "vf", enunciado: "Uma mesma conta pode, em situações diferentes, ter natureza Devedora e Credora ao mesmo tempo.", correta: false },
      ],
      // Exercício 2 — hierarquia e níveis do código
      [
        { tipo: "multipla", enunciado: "No código “1.1.1.01” (4 segmentos separados por ponto), esse é o nível de uma:", opcoes: ["Conta de Grupo", "Conta de Subgrupo", "Conta Sintética", "Conta Analítica"], correta: 3 },
        { tipo: "vf", enunciado: "Contas de nível Grupo e Subgrupo não recebem lançamento diretamente — servem só para agrupar e totalizar.", correta: true },
        { tipo: "multipla", enunciado: "O código “1.1” (2 segmentos) representa uma conta de nível:", opcoes: ["Grupo", "Subgrupo", "Conta Sintética", "Conta Analítica"], correta: 1 },
        { tipo: "vf", enunciado: "É possível existir uma “subconta analítica” de nível 5, como “1.1.1.02.01”, dentro de uma conta sintética de nível 4.", correta: true },
        { tipo: "multipla", enunciado: "Para uma conta poder receber lançamentos diretamente no sistema, ela precisa:", opcoes: ["Ser sempre de nível 4", "Estar marcada com a opção “Recebe lançamentos”", "Ser do grupo Ativo", "Não precisa de nenhuma marcação especial"], correta: 1 },
        { tipo: "vf", enunciado: "O código do plano de contas usa pontos (“.”) para indicar os níveis da hierarquia — cada segmento é um nível.", correta: true },
        { tipo: "multipla", enunciado: "O código “3.1.01” (3 segmentos) tem quantos níveis de hierarquia?", opcoes: ["1", "2", "3", "4"], correta: 2 },
        { tipo: "vf", enunciado: "É possível uma conta aceitar lançamento direto no nível 3 (Conta Sintética), mesmo em outro ramo do plano a conta equivalente estando no nível 4.", correta: true },
        { tipo: "multipla", enunciado: "O código “1.2.3.09” tem 4 segmentos — isso corresponde a uma conta:", opcoes: ["De Grupo", "De Subgrupo", "Sintética", "Analítica"], correta: 3 },
        { tipo: "vf", enunciado: "Contas Sintéticas servem só para agrupar subtotais — no Balancete, só aparecem contas com movimento no período.", correta: true },
      ],
      // Exercício 3 — aplicação prática no sistema
      [
        { tipo: "multipla", enunciado: "No sistema, ao tentar selecionar uma conta de nível Grupo num lançamento, o que acontece?", opcoes: ["O lançamento é aceito normalmente", "A conta nem aparece como opção para lançamento", "O sistema lança automaticamente na conta certa", "É preciso senha do Mestre"], correta: 1 },
        { tipo: "vf", enunciado: "O Plano de Contas do sistema é único e compartilhado por todas as empresas cadastradas — não existe um plano diferente por empresa.", correta: true },
        { tipo: "multipla", enunciado: "Onde o professor edita o Plano de Contas do sistema?", opcoes: ["Direto no Firebase", "Na tela “Plano de Contas”, com histórico de alterações", "Só é possível editar por planilha externa", "Não é possível editar, só cadastrar novo"], correta: 1 },
        { tipo: "vf", enunciado: "Se o nome de uma conta for alterado no Plano de Contas, os lançamentos já feitos com aquele código passam a mostrar o novo nome automaticamente.", correta: true },
        { tipo: "multipla", enunciado: "Para que serve o botão de expandir/recolher na tela do Plano de Contas?", opcoes: ["Excluir contas em massa", "Mostrar ou ocultar as subcontas de um grupo", "Exportar o plano em PDF", "Trocar a natureza da conta"], correta: 1 },
        { tipo: "vf", enunciado: "Contas de Ativo com natureza Credora (contra-ativo, como “Depreciação Acumulada”) não podem existir no plano de contas do sistema.", correta: false },
        { tipo: "multipla", enunciado: "Se uma conta estiver marcada como “Controla estoque”, isso afeta diretamente qual módulo do sistema?", opcoes: ["DRE", "Controle de Estoque (PEPS/UEPS/MP)", "Central de Suporte", "Auditoria"], correta: 1 },
        { tipo: "vf", enunciado: "É possível cadastrar duas contas diferentes com o mesmo código no plano de contas.", correta: false },
        { tipo: "multipla", enunciado: "O campo “natureza” de uma conta indica:", opcoes: ["O grupo a que ela pertence", "O lado (débito ou crédito) que aumenta seu saldo", "Se ela aceita lançamento", "O nível dela na hierarquia"], correta: 1 },
        { tipo: "vf", enunciado: "Um lançamento a débito numa conta do grupo Receita tem o efeito de reduzir a receita (ex.: uma devolução de vendas).", correta: true },
      ],
    ],
    recuperacao: [
      { tipo: "vf", enunciado: "O grupo Ativo aumenta de saldo com lançamentos a débito.", correta: true },
      { tipo: "multipla", enunciado: "O grupo Patrimônio Líquido tem natureza:", opcoes: ["Devedora", "Credora", "Neutra", "Depende da conta"], correta: 1 },
      { tipo: "vf", enunciado: "Contas de Custos (como CMV) têm natureza Devedora, igual às Despesas.", correta: true },
      { tipo: "multipla", enunciado: "A conta “Banco X” pertence a qual grupo?", opcoes: ["Passivo", "Ativo", "Receita", "Despesa"], correta: 1 },
      { tipo: "vf", enunciado: "“Fornecedores” é uma conta de natureza Devedora.", correta: false },
      { tipo: "multipla", enunciado: "Entre as opções, qual conta tem natureza Devedora?", opcoes: ["Duplicatas a Pagar", "Capital Subscrito", "Estoque de Mercadorias", "Receita de Vendas"], correta: 2 },
      { tipo: "vf", enunciado: "O Ativo representa as obrigações da empresa com terceiros.", correta: false },
      { tipo: "multipla", enunciado: "Um lançamento a débito numa conta de natureza Devedora tem o efeito de:", opcoes: ["Diminuir o saldo", "Aumentar o saldo", "Zerar o saldo", "Não afeta"], correta: 1 },
      { tipo: "vf", enunciado: "Uma conta pode mudar de natureza dependendo do lançamento feito nela.", correta: false },
      { tipo: "multipla", enunciado: "O código “2.1.1.01” corresponde a que nível hierárquico?", opcoes: ["Grupo", "Subgrupo", "Conta Sintética", "Conta Analítica"], correta: 3 },
      { tipo: "vf", enunciado: "Contas de nível Subgrupo recebem lançamento diretamente, assim como as Analíticas.", correta: false },
      { tipo: "multipla", enunciado: "O código “2.1” (2 segmentos) é de que nível?", opcoes: ["Grupo", "Subgrupo", "Sintética", "Analítica"], correta: 1 },
      { tipo: "vf", enunciado: "Uma “subconta analítica” de nível 5 só pode existir dentro de uma conta de nível 4.", correta: true },
      { tipo: "multipla", enunciado: "O que define se uma conta pode receber lançamento direto no sistema?", opcoes: ["O nível dela ser sempre 4", "A opção “Recebe lançamentos” estar marcada nela", "Pertencer ao grupo Ativo", "Ter código com menos de 3 dígitos"], correta: 1 },
      { tipo: "vf", enunciado: "Cada ponto no código do plano de contas representa a passagem para um nível mais profundo da hierarquia.", correta: true },
      { tipo: "multipla", enunciado: "O código “3.1.01” tem quantos segmentos (níveis)?", opcoes: ["1", "2", "3", "4"], correta: 2 },
      { tipo: "vf", enunciado: "Todo plano de contas tem exatamente 4 níveis de profundidade, sem exceção.", correta: false },
      { tipo: "multipla", enunciado: "O código “1.2.3.09” representa uma conta de qual nível?", opcoes: ["Grupo", "Subgrupo", "Sintética", "Analítica"], correta: 3 },
      { tipo: "vf", enunciado: "No Balancete, contas Sintéticas sem nenhum movimento no período não aparecem listadas.", correta: true },
      { tipo: "multipla", enunciado: "Ao tentar lançar direto numa conta de Grupo no sistema, o resultado é:", opcoes: ["Lançamento aceito normalmente", "A conta não aparece para seleção", "O sistema pede senha extra", "É criado um alerta de auditoria"], correta: 1 },
      { tipo: "vf", enunciado: "Cada empresa cadastrada no sistema tem seu próprio plano de contas independente das demais.", correta: false },
      { tipo: "multipla", enunciado: "Onde fica o histórico de alterações do Plano de Contas?", opcoes: ["Não existe histórico", "Na própria tela do Plano de Contas", "Só no Firebase, fora do sistema", "Na Central de Suporte"], correta: 1 },
      { tipo: "vf", enunciado: "Renomear uma conta no Plano de Contas atualiza automaticamente o nome exibido nos lançamentos antigos feitos com aquele código.", correta: true },
      { tipo: "multipla", enunciado: "O botão de expandir/recolher no Plano de Contas serve para:", opcoes: ["Excluir contas", "Mostrar/ocultar subcontas de um grupo", "Mudar a natureza da conta", "Gerar relatório em PDF"], correta: 1 },
      { tipo: "vf", enunciado: "Contas de Ativo com natureza Credora (contra-ativo) nunca podem existir no plano de contas.", correta: false },
      { tipo: "multipla", enunciado: "Marcar uma conta como “Controla estoque” afeta diretamente qual módulo?", opcoes: ["Central de Suporte", "Controle de Estoque", "Auditoria", "Backup"], correta: 1 },
      { tipo: "vf", enunciado: "É permitido cadastrar duas contas com códigos idênticos, desde que os nomes sejam diferentes.", correta: false },
      { tipo: "multipla", enunciado: "O campo “natureza” de uma conta serve para indicar:", opcoes: ["O nível hierárquico dela", "O lado que aumenta o saldo (débito ou crédito)", "Se ela controla estoque", "O grupo do DRE"], correta: 1 },
      { tipo: "vf", enunciado: "Um lançamento a débito numa conta de Receita reduz o valor da receita registrada (ex.: devolução de vendas).", correta: true },
      { tipo: "multipla", enunciado: "Entre as opções, qual conta é do grupo Receita?", opcoes: ["Receita de Vendas", "Despesas com Aluguel", "CMV", "Capital Subscrito"], correta: 0 },
    ],
  },
};

function AtividadeAvaliativa({ moduloId, moduloLabel, perfil, empresas, notas, salvarNotas, registrarAuditoria }) {
  const perguntas = BANCO_ATIVIDADES[moduloId] || [];
  const [aberto, setAberto] = useState(false);
  const [respostas, setRespostas] = useState({});
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null); // só usado por quem não é Aluno (não persiste)

  const souAluno = perfil?.tipo === "Aluno";

  if (perguntas.length === 0) return null;

  const registro = souAluno
    ? (notas || []).find((n) => n.alunoId === perfil.uid && n.moduloId === moduloId)
    : null;
  const tentativas = registro?.tentativas || 0;

  const responder = (i, valor) => setRespostas((r) => ({ ...r, [i]: valor }));
  const todasRespondidas = perguntas.every((_, i) => respostas[i] !== undefined);

  const salvarResultado = async (notaObtida, ehRecuperacao) => {
    const empresaDoAluno = (empresas || []).find((e) => e.alunoId === perfil.uid);
    let novoRegistro;
    if (!ehRecuperacao) {
      novoRegistro = {
        id: registro?.id || uid("nota"),
        alunoId: perfil.uid,
        alunoNome: perfil.nome,
        turmaId: perfil.turmaId,
        empresaId: empresaDoAluno?.id || null,
        moduloId,
        moduloLabel,
        notaOriginal: notaObtida,
        notaRecuperacao: null,
        nota: notaObtida,
        tentativas: 1,
        avaliadoPor: "Atividade automática",
        avaliadoEm: Date.now(),
      };
    } else {
      const notaFinal = Math.max(registro.notaOriginal, notaObtida);
      novoRegistro = {
        ...registro,
        notaRecuperacao: notaObtida,
        nota: notaFinal,
        tentativas: 2,
        avaliadoPor: "Atividade automática",
        avaliadoEm: Date.now(),
      };
    }
    const outras = (notas || []).filter((n) => !(n.alunoId === perfil.uid && n.moduloId === moduloId));
    await salvarNotas([...outras, novoRegistro]);
    if (registrarAuditoria) {
      await registrarAuditoria(
        "editar",
        "sistema",
        ehRecuperacao
          ? `${perfil.nome} fez a Recuperação Paralela de "${moduloLabel}" com nota ${notaObtida} (nota final: ${novoRegistro.nota})`
          : `${perfil.nome} concluiu a atividade avaliativa de "${moduloLabel}" com nota ${notaObtida}`
      );
    }
  };

  const corrigir = async () => {
    let acertos = 0;
    perguntas.forEach((p, i) => {
      if (respostas[i] === p.correta) acertos += 1;
    });
    const notaObtida = Math.round((acertos / perguntas.length) * 10 * 10) / 10;

    if (souAluno) {
      await salvarResultado(notaObtida, modoRecuperacao);
      setModoRecuperacao(false);
      setRespostas({});
    } else {
      setResultadoTeste({ acertos, total: perguntas.length, nota: notaObtida });
    }
  };

  const fechar = () => setAberto(false);

  // Resumo mostrado no "tópico" fechado, antes de clicar para abrir.
  let resumo;
  if (!souAluno) {
    resumo = "Clique para conferir as questões (não grava nota).";
  } else if (registro?.overrideProfessor) {
    // Nota foi sobrescrita manualmente pelo professor (tela Notas) — não usa
    // o status da atividade automática, que pode estar desatualizado.
    resumo = `Nota definida pelo professor(a): ${numFmt(registro.nota)}`;
  } else if (tentativas >= 2) {
    resumo = `Concluída — nota final ${numFmt(registro.nota)}`;
  } else if (tentativas === 1) {
    resumo = `Nota da atividade original: ${numFmt(registro.notaOriginal)} — Recuperação Paralela disponível`;
  } else {
    resumo = `${perguntas.length} questões — ainda não feita`;
  }

  const Formulario = ({ aoCorrigir, textoBotao }) => (
    <>
      <div className="space-y-4">
        {perguntas.map((p, i) => (
          <Card key={i}>
            <div className="text-sm font-semibold text-ink mb-2">
              {i + 1}. {p.enunciado}
            </div>
            {p.tipo === "vf" ? (
              <div className="flex gap-2">
                {[
                  { valor: true, label: "Verdadeiro" },
                  { valor: false, label: "Falso" },
                ].map((op) => (
                  <button
                    key={op.label}
                    type="button"
                    onClick={() => responder(i, op.valor)}
                    className={
                      "px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors " +
                      (respostas[i] === op.valor
                        ? "bg-green text-white border-green"
                        : "border-line text-inkSoft hover:text-ink")
                    }
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {p.opcoes.map((op, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => responder(i, oi)}
                    className={
                      "w-full text-left px-3 py-1.5 rounded-lg text-sm border transition-colors " +
                      (respostas[i] === oi
                        ? "bg-green text-white border-green"
                        : "border-line text-inkSoft hover:text-ink")
                    }
                  >
                    {op}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <Botao onClick={aoCorrigir} disabled={!todasRespondidas}>
          {textoBotao}
        </Botao>
      </div>
    </>
  );

  const renderConteudo = () => {
    // --- Quem não é Aluno: só testa, nunca grava nota, sempre pode refazer localmente. ---
    if (!souAluno) {
      return !resultadoTeste ? (
        <Formulario aoCorrigir={corrigir} textoBotao="Corrigir atividade" />
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <Card className="inline-block">
            <div className="text-sm text-ink">
              Acertos: <b>{resultadoTeste.acertos}</b> de <b>{resultadoTeste.total}</b> — nota:{" "}
              <b className={resultadoTeste.nota >= 6 ? "text-green" : "text-red"}>{numFmt(resultadoTeste.nota)}</b>
            </div>
          </Card>
          <Botao
            variant="ghost"
            onClick={() => {
              setRespostas({});
              setResultadoTeste(null);
            }}
          >
            Testar de novo
          </Botao>
        </div>
      );
    }

    // --- Nota sobrescrita manualmente pelo professor: sempre trava aqui,
    // não usa o fluxo automático (que teria dados possivelmente desatualizados). ---
    if (registro?.overrideProfessor) {
      return (
        <Card>
          <div className="text-sm text-ink">
            Nota definida manualmente pelo professor(a):{" "}
            <b className={registro.nota >= 6 ? "text-green" : "text-red"}>{numFmt(registro.nota)}</b>
          </div>
          <p className="text-xs text-inkSoft mt-1.5">
            Avaliado por {registro.avaliadoPor} em {fmtDateTime(registro.avaliadoEm)}.
          </p>
        </Card>
      );
    }

    // --- Aluno, tentativas === 2: já usou a atividade original + a recuperação. Travado. ---
    if (tentativas >= 2) {
      return (
        <>
          <Card>
            <div className="text-sm text-ink space-y-1.5">
              <div>Nota da atividade original: <b>{numFmt(registro.notaOriginal)}</b></div>
              <div>Nota da Recuperação Paralela: <b>{numFmt(registro.notaRecuperacao)}</b></div>
              <div className="pt-1.5 border-t border-line mt-1">
                Nota final (prevalece a maior):{" "}
                <b className={registro.nota >= 6 ? "text-green" : "text-red"}>{numFmt(registro.nota)}</b>
              </div>
            </div>
          </Card>
          <p className="text-xs text-inkSoft mt-2">
            Você já usou as duas tentativas permitidas para este módulo (atividade original + Recuperação
            Paralela).
          </p>
        </>
      );
    }

    // --- Aluno, tentativas === 1, ainda não entrou no modo recuperação: mostra a nota e o botão. ---
    if (tentativas === 1 && !modoRecuperacao) {
      return (
        <>
          <Card className="mb-3">
            <div className="text-sm text-ink">
              Nota da atividade original:{" "}
              <b className={registro.notaOriginal >= 6 ? "text-green" : "text-red"}>{numFmt(registro.notaOriginal)}</b>
            </div>
          </Card>
          <Botao
            onClick={() => {
              setRespostas({});
              setModoRecuperacao(true);
            }}
          >
            Fazer Recuperação Paralela
          </Botao>
          <p className="text-xs text-inkSoft mt-2">
            Você terá direito a uma única tentativa adicional. Prevalece sempre a maior nota entre a atividade
            original e a Recuperação Paralela — não existirá nova tentativa depois desta.
          </p>
        </>
      );
    }

    // --- Aluno respondendo agora: primeira tentativa (tentativas === 0) ou recuperação (modoRecuperacao). ---
    return (
      <>
        {modoRecuperacao && (
          <div className="text-sm text-ink bg-gold/10 border border-gold/40 rounded-lg p-3 mb-4">
            Você está fazendo a <b>Recuperação Paralela</b> — sua nota original ({numFmt(registro.notaOriginal)})
            fica guardada, e a nota final será a maior entre as duas.
          </div>
        )}
        <Formulario aoCorrigir={corrigir} textoBotao={modoRecuperacao ? "Enviar Recuperação Paralela" : "Corrigir atividade"} />
      </>
    );
  };

  return (
    <div className="mt-8 pt-6 border-t border-line">
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full flex items-center justify-between gap-3 bg-white border border-line rounded-xl px-4 py-3 hover:border-green transition-colors text-left"
      >
        <div>
          <div className="font-serif font-semibold text-ink text-base">Atividade Avaliativa — {moduloLabel}</div>
          <div className="text-xs text-inkSoft mt-0.5">{resumo}</div>
        </div>
        <ChevronRight size={18} className="text-inkSoft shrink-0" />
      </button>

      {aberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={fechar}>
          <div
            className="bg-paper rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="font-serif font-semibold text-ink text-lg">Atividade Avaliativa</h3>
              <button onClick={fechar} className="text-inkSoft hover:text-ink shrink-0" title="Fechar">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-inkSoft mb-4">
              {perguntas.length} questões (múltipla escolha e Verdadeiro/Falso) sobre {moduloLabel.toLowerCase()} —
              correção automática, nota de 0,0 a 10,0.
              {!souAluno && " Como você não é Aluno, pode responder só para conferir, sem gravar nota."}
            </p>
            {renderConteudo()}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Avaliação V2 (3 exercícios de 10 questões + Recuperação Paralela de
// 30 questões, que substitui a MÉDIA dos 3, não só o exercício mais fraco;
// + Termo de Desistência) — piloto em Plano de Contas (Fase 6). ----
const NOTA_MINIMA_SATISFATORIA = 6;

function AtividadeAvaliativaV2({
  moduloId,
  moduloLabel,
  perfil,
  empresas,
  notas,
  salvarNotas,
  registrarAuditoria,
  turmas,
  usuarios,
  prazosAtividades,
  salvarPrazosAtividades,
  liberacoesExcecao,
  salvarLiberacoesExcecao,
}) {
  const banco = AVALIACOES_V2[moduloId];
  const [aberto, setAberto] = useState(false);
  const [exercicioAtivo, setExercicioAtivo] = useState(null); // 0, 1, 2, "recuperacao" ou null
  const [respostas, setRespostas] = useState({});
  const [confirmandoDesistencia, setConfirmandoDesistencia] = useState(false);
  const [aceiteTermo, setAceiteTermo] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null); // só para quem não é Aluno
  // Painel do professor: turma sendo configurada, formulário de prazo, e
  // liberação excepcional em edição (aluno + nova data/hora limite).
  const [turmaConfigId, setTurmaConfigId] = useState((turmas || [])[0]?.id || "");
  const [formPrazo, setFormPrazo] = useState({ inicio: "", fim: "" });
  const [liberandoAlunoUid, setLiberandoAlunoUid] = useState(null);
  const [novoPrazoLiberacao, setNovoPrazoLiberacao] = useState("");

  const souAluno = perfil?.tipo === "Aluno";

  if (!banco) return null;

  const registro = souAluno
    ? (notas || []).find((n) => n.alunoId === perfil.uid && n.moduloId === moduloId)
    : null;
  const notasExercicios = registro?.notasExercicios || [null, null, null];
  const todosExerciciosFeitos = notasExercicios.every((n) => n !== null);
  const mediaExercicios = todosExerciciosFeitos
    ? Math.round((notasExercicios.reduce((s, n) => s + n, 0) / 3) * 10) / 10
    : null;
  const mediaSatisfatoria = mediaExercicios !== null && mediaExercicios >= NOTA_MINIMA_SATISFATORIA;
  const precisaDeDecisao = todosExerciciosFeitos && !registro?.desistiu && registro?.notaRecuperacao == null;
  const notaFinal = registro?.nota ?? mediaExercicios;
  const moduloTotalmenteConcluido = todosExerciciosFeitos && (registro?.desistiu || registro?.notaRecuperacao != null);

  // ---- Prazo (por turma) e liberação excepcional (por aluno) ----
  const prazoTurmaDoAluno = souAluno
    ? (prazosAtividades || []).find((p) => p.turmaId === perfil?.turmaId && p.moduloId === moduloId)
    : null;
  const liberacoesDoAluno = souAluno
    ? (liberacoesExcecao || []).filter((l) => l.alunoId === perfil?.uid && l.moduloId === moduloId)
    : [];
  const ultimaLiberacaoDoAluno = liberacoesDoAluno.sort((a, b) => b.concedidoEm - a.concedidoEm)[0] || null;
  const agora = Date.now();
  const inicioMs = prazoTurmaDoAluno?.inicio ? new Date(prazoTurmaDoAluno.inicio).getTime() : null;
  const fimEfetivoMs = ultimaLiberacaoDoAluno
    ? new Date(ultimaLiberacaoDoAluno.novoPrazoFim).getTime()
    : prazoTurmaDoAluno?.fim
    ? new Date(prazoTurmaDoAluno.fim).getTime()
    : null;
  const aindaNaoComecou = inicioMs !== null && agora < inicioMs;
  const prazoEncerrado = fimEfetivoMs !== null && agora > fimEfetivoMs;
  // Só bloqueia quem ainda não terminou tudo — quem já concluiu (com decisão
  // de RP/desistência tomada) sempre pode ver o próprio resultado.
  const bloqueadoPorPrazo =
    souAluno && !moduloTotalmenteConcluido && !registro?.overrideProfessor && (aindaNaoComecou || prazoEncerrado);

  const perguntasAtivas =
    exercicioAtivo === "recuperacao" ? banco.recuperacao : exercicioAtivo !== null ? banco.exercicios[exercicioAtivo] : [];
  const responder = (i, valor) => setRespostas((r) => ({ ...r, [i]: valor }));
  const todasRespondidas = perguntasAtivas.every((_, i) => respostas[i] !== undefined);

  const empresaDoAluno = (empresas || []).find((e) => e.alunoId === perfil?.uid);

  const registroBase = () => ({
    id: registro?.id || uid("nota"),
    alunoId: perfil.uid,
    alunoNome: perfil.nome,
    turmaId: perfil.turmaId,
    empresaId: empresaDoAluno?.id || null,
    moduloId,
    moduloLabel,
    notasExercicios: registro?.notasExercicios || [null, null, null],
    notaRecuperacao: registro?.notaRecuperacao ?? null,
    desistiu: registro?.desistiu || false,
    desistenciaEm: registro?.desistenciaEm || null,
  });

  const salvar = async (novoRegistro, descricaoAuditoria) => {
    const outras = (notas || []).filter((n) => !(n.alunoId === perfil.uid && n.moduloId === moduloId));
    await salvarNotas([...outras, novoRegistro]);
    if (registrarAuditoria) await registrarAuditoria("editar", "sistema", descricaoAuditoria);
  };

  const salvarExercicio = async (indice, notaObtida) => {
    const base = registroBase();
    const novasNotas = [...base.notasExercicios];
    novasNotas[indice] = notaObtida;
    const mediaNova =
      novasNotas.every((n) => n !== null) ? Math.round((novasNotas.reduce((s, n) => s + n, 0) / 3) * 10) / 10 : null;
    const novoRegistro = {
      ...base,
      notasExercicios: novasNotas,
      nota: mediaNova, // provisório: some/troca se a recuperação ou desistência entrar em jogo
      avaliadoPor: "Atividade automática",
      avaliadoEm: Date.now(),
    };
    await salvar(
      novoRegistro,
      `${perfil.nome} concluiu o Exercício ${indice + 1} de "${moduloLabel}" com nota ${notaObtida}`
    );
  };

  const salvarRecuperacao = async (notaObtida) => {
    const base = registroBase();
    const notaFinalNova = Math.max(mediaExercicios, notaObtida);
    const novoRegistro = {
      ...base,
      notaRecuperacao: notaObtida,
      nota: notaFinalNova,
      avaliadoPor: "Atividade automática",
      avaliadoEm: Date.now(),
    };
    await salvar(
      novoRegistro,
      `${perfil.nome} fez a Recuperação Paralela de "${moduloLabel}" com nota ${notaObtida} (nota final: ${notaFinalNova})`
    );
  };

  const confirmarDesistencia = async () => {
    const base = registroBase();
    const novoRegistro = {
      ...base,
      desistiu: true,
      desistenciaEm: Date.now(),
      nota: mediaExercicios,
      avaliadoPor: "Atividade automática",
      avaliadoEm: Date.now(),
    };
    await salvar(novoRegistro, `${perfil.nome} assinou o Termo de Desistência da Recuperação Paralela de "${moduloLabel}"`);
    setConfirmandoDesistencia(false);
    setAceiteTermo(false);
  };

  // ---- Painel do professor: prazo por turma + liberação excepcional ----
  const prazoDaTurmaConfig = (prazosAtividades || []).find(
    (p) => p.turmaId === turmaConfigId && p.moduloId === moduloId
  );

  const salvarPrazoTurma = async () => {
    if (!formPrazo.inicio || !formPrazo.fim) return;
    const outros = (prazosAtividades || []).filter((p) => !(p.turmaId === turmaConfigId && p.moduloId === moduloId));
    const novoPrazo = {
      id: prazoDaTurmaConfig?.id || uid("prazo"),
      turmaId: turmaConfigId,
      moduloId,
      moduloLabel,
      inicio: formPrazo.inicio,
      fim: formPrazo.fim,
      definidoPor: perfil.nome,
      definidoEm: Date.now(),
    };
    await salvarPrazosAtividades([...outros, novoPrazo]);
    if (registrarAuditoria) {
      const turmaNome = (turmas || []).find((t) => t.id === turmaConfigId)?.nome || turmaConfigId;
      await registrarAuditoria(
        "editar",
        "sistema",
        `${perfil.nome} definiu o prazo de "${moduloLabel}" para a turma "${turmaNome}": ${fmtDateTime(new Date(formPrazo.inicio).getTime())} até ${fmtDateTime(new Date(formPrazo.fim).getTime())}`
      );
    }
  };

  const concederLiberacao = async (aluno) => {
    if (!novoPrazoLiberacao) return;
    const nova = {
      id: uid("liberacao"),
      alunoId: aluno.uid,
      alunoNome: aluno.nome,
      moduloId,
      moduloLabel,
      professorNome: perfil.nome,
      concedidoEm: Date.now(),
      novoPrazoFim: novoPrazoLiberacao,
    };
    await salvarLiberacoesExcecao([...(liberacoesExcecao || []), nova]);
    if (registrarAuditoria) {
      await registrarAuditoria(
        "editar",
        "sistema",
        `${perfil.nome} liberou excepcionalmente "${moduloLabel}" para ${aluno.nome} até ${fmtDateTime(new Date(novoPrazoLiberacao).getTime())}`
      );
    }
    setLiberandoAlunoUid(null);
    setNovoPrazoLiberacao("");
  };

  const corrigir = async () => {
    let acertos = 0;
    perguntasAtivas.forEach((p, i) => {
      if (respostas[i] === p.correta) acertos += 1;
    });
    const notaObtida = Math.round((acertos / perguntasAtivas.length) * 10 * 10) / 10;

    if (souAluno) {
      if (exercicioAtivo === "recuperacao") await salvarRecuperacao(notaObtida);
      else await salvarExercicio(exercicioAtivo, notaObtida);
      setExercicioAtivo(null);
      setRespostas({});
    } else {
      setResultadoTeste({ acertos, total: perguntasAtivas.length, nota: notaObtida });
    }
  };

  const Formulario = () => (
    <>
      <div className="space-y-4">
        {perguntasAtivas.map((p, i) => (
          <Card key={i}>
            <div className="text-sm font-semibold text-ink mb-2">
              {i + 1}. {p.enunciado}
            </div>
            {p.tipo === "vf" ? (
              <div className="flex gap-2">
                {[
                  { valor: true, label: "Verdadeiro" },
                  { valor: false, label: "Falso" },
                ].map((op) => (
                  <button
                    key={op.label}
                    type="button"
                    onClick={() => responder(i, op.valor)}
                    className={
                      "px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors " +
                      (respostas[i] === op.valor ? "bg-green text-white border-green" : "border-line text-inkSoft hover:text-ink")
                    }
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {p.opcoes.map((op, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => responder(i, oi)}
                    className={
                      "w-full text-left px-3 py-1.5 rounded-lg text-sm border transition-colors " +
                      (respostas[i] === oi ? "bg-green text-white border-green" : "border-line text-inkSoft hover:text-ink")
                    }
                  >
                    {op}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Botao onClick={corrigir} disabled={!todasRespondidas}>
          {exercicioAtivo === "recuperacao" ? "Enviar Recuperação Paralela" : "Corrigir exercício"}
        </Botao>
        <Botao
          variant="ghost"
          onClick={() => {
            setExercicioAtivo(null);
            setRespostas({});
          }}
        >
          Cancelar
        </Botao>
      </div>
    </>
  );

  // Resumo mostrado no "tópico" fechado.
  let resumo;
  if (!souAluno) {
    resumo = "Clique para conferir os exercícios (não grava nota).";
  } else if (registro?.overrideProfessor) {
    resumo = `Nota definida pelo professor(a): ${numFmt(registro.nota)}`;
  } else if (notaFinal !== null && (registro?.desistiu || registro?.notaRecuperacao != null)) {
    resumo = `Concluído — nota final ${numFmt(notaFinal)}`;
  } else if (precisaDeDecisao) {
    resumo = `Média dos 3 exercícios: ${numFmt(mediaExercicios)} — Recuperação Paralela disponível`;
  } else {
    const feitos = notasExercicios.filter((n) => n !== null).length;
    resumo = `${feitos} de 3 exercícios concluídos`;
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="w-full flex items-center justify-between text-left border-t border-line pt-4 pb-1"
      >
        <span className="text-base font-serif font-semibold text-ink">Atividade Avaliativa — {moduloLabel}</span>
        <span className="text-xs text-inkSoft">{aberto ? "Fechar ▲" : "Abrir ▼"}</span>
      </button>
      <p className="text-xs text-inkSoft mb-2">{resumo}</p>

      {aberto && (
        <div className="mt-3">
          {/* --- Quem não é Aluno: configura prazo da turma, libera exceções, e testa livremente (nunca grava nota). --- */}
          {!souAluno && (
            <>
              {(turmas || []).length > 0 && (
                <Card className="mb-3">
                  <p className="text-xs font-semibold text-ink uppercase tracking-wide mb-2">Prazo da atividade — por turma</p>
                  <div className="flex flex-wrap items-end gap-2 mb-2">
                    <Field label="Turma">
                      <SelectInput
                        value={turmaConfigId}
                        onChange={(e) => {
                          setTurmaConfigId(e.target.value);
                          const p = (prazosAtividades || []).find((pr) => pr.turmaId === e.target.value && pr.moduloId === moduloId);
                          setFormPrazo({ inicio: p?.inicio || "", fim: p?.fim || "" });
                        }}
                      >
                        {(turmas || []).map((t) => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Início">
                      <TxtInput
                        type="datetime-local"
                        value={formPrazo.inicio}
                        onChange={(e) => setFormPrazo({ ...formPrazo, inicio: e.target.value })}
                      />
                    </Field>
                    <Field label="Encerramento">
                      <TxtInput
                        type="datetime-local"
                        value={formPrazo.fim}
                        onChange={(e) => setFormPrazo({ ...formPrazo, fim: e.target.value })}
                      />
                    </Field>
                    <Botao onClick={salvarPrazoTurma}>Salvar prazo da turma</Botao>
                  </div>
                  {prazoDaTurmaConfig && (
                    <p className="text-xs text-inkSoft">
                      Prazo atual: {fmtDateTime(new Date(prazoDaTurmaConfig.inicio).getTime())} até{" "}
                      {fmtDateTime(new Date(prazoDaTurmaConfig.fim).getTime())} — definido por {prazoDaTurmaConfig.definidoPor}.
                    </p>
                  )}

                  {(usuarios || []).filter((u) => u.tipo === "Aluno" && u.turmaId === turmaConfigId).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-line">
                      <p className="text-xs font-semibold text-ink uppercase tracking-wide mb-2">Situação dos alunos</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-inkSoft border-b border-line">
                            <th className="py-1 pr-2">Aluno</th>
                            <th className="py-1 pr-2">Situação</th>
                            <th className="py-1 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(usuarios || [])
                            .filter((u) => u.tipo === "Aluno" && u.turmaId === turmaConfigId)
                            .map((aluno) => {
                              const registroAluno = (notas || []).find((n) => n.alunoId === aluno.uid && n.moduloId === moduloId);
                              const feitos = (registroAluno?.notasExercicios || [null, null, null]).filter((n) => n !== null).length;
                              const concluidoAluno =
                                feitos === 3 && (registroAluno?.desistiu || registroAluno?.notaRecuperacao != null || registroAluno?.overrideProfessor);
                              const liberacoesAluno = (liberacoesExcecao || []).filter(
                                (l) => l.alunoId === aluno.uid && l.moduloId === moduloId
                              );
                              const ultimaLib = liberacoesAluno.sort((a, b) => b.concedidoEm - a.concedidoEm)[0];
                              const fimEfetivo = ultimaLib
                                ? new Date(ultimaLib.novoPrazoFim).getTime()
                                : prazoDaTurmaConfig?.fim
                                ? new Date(prazoDaTurmaConfig.fim).getTime()
                                : null;
                              const encerradoAluno = !concluidoAluno && fimEfetivo !== null && Date.now() > fimEfetivo;
                              return (
                                <tr key={aluno.uid} className="border-b border-line/50">
                                  <td className="py-1 pr-2">{aluno.nome}</td>
                                  <td className="py-1 pr-2">
                                    {concluidoAluno ? (
                                      <Pill tone="green">Concluído</Pill>
                                    ) : encerradoAluno ? (
                                      <Pill tone="default">Prazo encerrado</Pill>
                                    ) : (
                                      <Pill tone="gold">{feitos} de 3 exercícios</Pill>
                                    )}
                                  </td>
                                  <td className="py-1 text-right">
                                    {encerradoAluno &&
                                      (liberandoAlunoUid === aluno.uid ? (
                                        <div className="flex items-center gap-1 justify-end">
                                          <input
                                            type="datetime-local"
                                            className="border border-line rounded px-1 py-0.5 text-xs"
                                            value={novoPrazoLiberacao}
                                            onChange={(e) => setNovoPrazoLiberacao(e.target.value)}
                                          />
                                          <Botao onClick={() => concederLiberacao(aluno)} disabled={!novoPrazoLiberacao}>
                                            Confirmar
                                          </Botao>
                                          <Botao variant="ghost" onClick={() => setLiberandoAlunoUid(null)}>✕</Botao>
                                        </div>
                                      ) : (
                                        <Botao variant="ghost" onClick={() => setLiberandoAlunoUid(aluno.uid)}>
                                          Liberar para este aluno
                                        </Botao>
                                      ))}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}

              {exercicioAtivo === null ? (
                <div className="flex gap-2 flex-wrap">
                  {banco.exercicios.map((_, i) => (
                    <Botao key={i} variant="ghost" onClick={() => { setExercicioAtivo(i); setRespostas({}); setResultadoTeste(null); }}>
                      Testar Exercício {i + 1}
                    </Botao>
                  ))}
                  <Botao variant="ghost" onClick={() => { setExercicioAtivo("recuperacao"); setRespostas({}); setResultadoTeste(null); }}>
                    Testar Recuperação (30 questões)
                  </Botao>
                </div>
              ) : !resultadoTeste ? (
                <Formulario />
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <Card className="inline-block">
                    <div className="text-sm text-ink">
                      Acertos: <b>{resultadoTeste.acertos}</b> de <b>{resultadoTeste.total}</b> — nota:{" "}
                      <b className={resultadoTeste.nota >= NOTA_MINIMA_SATISFATORIA ? "text-green" : "text-red"}>{numFmt(resultadoTeste.nota)}</b>
                    </div>
                  </Card>
                  <Botao variant="ghost" onClick={() => { setRespostas({}); setResultadoTeste(null); setExercicioAtivo(null); }}>
                    Voltar
                  </Botao>
                </div>
              )}
            </>
          )}

          {/* --- Aluno: nota sobrescrita manualmente pelo professor — trava aqui. --- */}
          {souAluno && registro?.overrideProfessor && (
            <Card>
              <div className="text-sm text-ink">
                Nota definida manualmente pelo professor(a):{" "}
                <b className={registro.nota >= NOTA_MINIMA_SATISFATORIA ? "text-green" : "text-red"}>{numFmt(registro.nota)}</b>
              </div>
              <p className="text-xs text-inkSoft mt-1.5">
                Avaliado por {registro.avaliadoPor} em {fmtDateTime(registro.avaliadoEm)}.
              </p>
            </Card>
          )}

          {/* --- Aluno: prazo ainda não começou ou já encerrado — bloqueado. --- */}
          {souAluno && !registro?.overrideProfessor && bloqueadoPorPrazo && (
            <Card>
              <div className="flex items-center gap-2 text-sm text-ink">
                <ShieldCheck size={16} className="text-inkSoft" />
                {aindaNaoComecou ? (
                  <span>
                    Atividade ainda não liberada. Disponível a partir de{" "}
                    <b>{fmtDateTime(inicioMs)}</b>.
                  </span>
                ) : (
                  <span>
                    Prazo encerrado. Esta atividade encontra-se bloqueada. Caso seja necessária uma nova liberação,
                    procure o professor.
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* --- Aluno: respondendo um exercício ou a recuperação agora. --- */}
          {souAluno && !registro?.overrideProfessor && !bloqueadoPorPrazo && exercicioAtivo !== null && <Formulario />}

          {/* --- Aluno: visão normal (cards dos 3 exercícios + decisão/nota final). --- */}
          {souAluno && !registro?.overrideProfessor && !bloqueadoPorPrazo && exercicioAtivo === null && (
            <>
              <div className="grid sm:grid-cols-3 gap-3 mb-3">
                {banco.exercicios.map((perguntas, i) => {
                  const notaEx = notasExercicios[i];
                  const feito = notaEx !== null;
                  return (
                    <Card key={i} className={feito ? "" : "border-gold/40"}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-ink">Exercício {i + 1}</span>
                        {feito && <Pill tone="green">Corrigido</Pill>}
                      </div>
                      <p className="text-xs text-inkSoft mb-2">{perguntas.length} questões</p>
                      {feito ? (
                        <p className={"text-lg font-semibold " + (notaEx >= NOTA_MINIMA_SATISFATORIA ? "text-green" : "text-red")}>
                          {numFmt(notaEx)}
                        </p>
                      ) : (
                        <Botao onClick={() => { setExercicioAtivo(i); setRespostas({}); }}>Responder</Botao>
                      )}
                    </Card>
                  );
                })}
              </div>

              {todosExerciciosFeitos && !registro?.desistiu && registro?.notaRecuperacao == null && (
                <Card className={mediaSatisfatoria ? "mb-3" : "mb-3 border-gold/40"}>
                  <p className="text-sm text-ink">
                    Média do módulo:{" "}
                    <b className={mediaSatisfatoria ? "text-green" : "text-red"}>{numFmt(mediaExercicios)}</b>
                    {!mediaSatisfatoria && ` — abaixo de ${numFmt(NOTA_MINIMA_SATISFATORIA)}`}
                  </p>
                </Card>
              )}

              {precisaDeDecisao && !confirmandoDesistencia && (
                <div className="flex gap-2 flex-wrap">
                  <Botao onClick={() => { setExercicioAtivo("recuperacao"); setRespostas({}); }}>
                    Fazer Recuperação Paralela
                  </Botao>
                  <Botao variant="ghost" onClick={() => setConfirmandoDesistencia(true)}>
                    Assinar Termo de Desistência
                  </Botao>
                </div>
              )}

              {precisaDeDecisao && confirmandoDesistencia && (
                <Card className="border-gold/40">
                  <p className="text-sm font-semibold text-ink mb-1.5">Termo de Desistência da Recuperação Paralela</p>
                  <p className="text-xs text-inkSoft mb-3">
                    Declaro, de forma consciente e voluntária, que estou ciente do meu direito de realizar esta
                    avaliação, porém opto por não fazê-la neste momento. Assumo total responsabilidade por essa
                    decisão, ciente de que não terei outra oportunidade para sua realização e de que a nota
                    correspondente será atribuída como zero, conforme as orientações institucionais.
                  </p>
                  <p className="text-xs text-inkSoft mb-3 italic">
                    Na prática: como você optou por não fazer a Recuperação Paralela, a nota dela fica zerada/não
                    realizada — mas isso não entra na sua média. Sua nota final neste módulo continua sendo a
                    média dos 3 exercícios ({numFmt(mediaExercicios)}).
                  </p>
                  <label className="flex items-center gap-2 text-xs text-ink mb-3">
                    <input type="checkbox" checked={aceiteTermo} onChange={(e) => setAceiteTermo(e.target.checked)} />
                    Li e concordo com os termos acima.
                  </label>
                  <div className="flex gap-2">
                    <Botao onClick={confirmarDesistencia} disabled={!aceiteTermo}>Confirmar desistência</Botao>
                    <Botao variant="ghost" onClick={() => { setConfirmandoDesistencia(false); setAceiteTermo(false); }}>
                      Voltar
                    </Botao>
                  </div>
                </Card>
              )}

              {todosExerciciosFeitos && (registro?.desistiu || registro?.notaRecuperacao != null) && (
                <Card>
                  <div className="text-sm text-ink space-y-1">
                    <div>Média dos 3 exercícios: <b>{numFmt(mediaExercicios)}</b></div>
                    {registro?.notaRecuperacao != null && (
                      <div>Nota da Recuperação Paralela: <b>{numFmt(registro.notaRecuperacao)}</b></div>
                    )}
                    {registro?.desistiu && (
                      <div className="text-inkSoft">
                        Termo de Desistência assinado em {fmtDateTime(registro.desistenciaEm)} — recuperação não realizada.
                      </div>
                    )}
                    <div className="pt-1 border-t border-line mt-1">
                      Nota final do módulo: <b className={notaFinal >= NOTA_MINIMA_SATISFATORIA ? "text-green" : "text-red"}>{numFmt(notaFinal)}</b>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GestaoNotasView({ perfil, turmas, usuarios, empresas, notas, salvarNotas, registrarAuditoria }) {
  const souAluno = perfil?.tipo === "Aluno";
  const [turmaId, setTurmaId] = useState(souAluno ? perfil?.turmaId || "" : (turmas || [])[0]?.id || "");
  const [editando, setEditando] = useState(null); // `${alunoUid}__${moduloId}`
  const [valorEdicao, setValorEdicao] = useState("");

  const alunosDaTurma = (usuarios || []).filter((u) => u.tipo === "Aluno" && u.turmaId === turmaId);
  const alunosVisiveis = souAluno ? alunosDaTurma.filter((a) => a.uid === perfil.uid) : alunosDaTurma;

  const notaDe = (alunoUid, moduloId) => (notas || []).find((n) => n.alunoId === alunoUid && n.moduloId === moduloId);

  const mediaDoAluno = (alunoUid) => {
    const encontradas = MODULOS_AVALIAVEIS.map((m) => notaDe(alunoUid, m.id)).filter(Boolean);
    if (encontradas.length === 0) return null;
    return encontradas.reduce((s, n) => s + Number(n.nota), 0) / encontradas.length;
  };

  const salvarNota = async (aluno, modulo) => {
    const chave = `${aluno.uid}__${modulo.id}`;
    const v = valorEdicao.trim().replace(",", ".");
    if (v === "") {
      setEditando(null);
      return;
    }
    const num = Number(v);
    if (Number.isNaN(num) || num < 0 || num > 10) {
      alert("A nota deve ser um número entre 0 e 10.");
      return;
    }
    const existente = notaDe(aluno.uid, modulo.id);
    const empresaDoAluno = (empresas || []).find((e) => e.alunoId === aluno.uid);
    let novasNotas;
    if (existente) {
      // overrideProfessor:true avisa os componentes de Atividade Avaliativa
      // (V1 e V2) para pararem de usar o status da tentativa automática, que
      // pode estar desatualizado em relação a essa nota manual.
      novasNotas = (notas || []).map((n) =>
        n.id === existente.id
          ? { ...n, nota: num, overrideProfessor: true, avaliadoPor: perfil.nome, avaliadoEm: Date.now() }
          : n
      );
    } else {
      novasNotas = [
        ...(notas || []),
        {
          id: uid("nota"),
          alunoId: aluno.uid,
          alunoNome: aluno.nome,
          turmaId: aluno.turmaId,
          empresaId: empresaDoAluno?.id || null,
          moduloId: modulo.id,
          moduloLabel: modulo.label,
          nota: num,
          overrideProfessor: true,
          avaliadoPor: perfil.nome,
          avaliadoEm: Date.now(),
        },
      ];
    }
    await salvarNotas(novasNotas);
    await registrarAuditoria("editar", "sistema", `Lançou nota ${num} para ${aluno.nome} em "${modulo.label}"`);
    setEditando(null);
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Notas</h2>
      <p className="text-sm text-inkSoft mb-4">
        {souAluno
          ? "Suas notas por módulo do ciclo contábil, lançadas pelo professor(a), e a média geral."
          : "Clique numa nota para editar — dê Enter ou clique fora para salvar. A média é calculada automaticamente pelos módulos já avaliados."}
      </p>

      {!souAluno && (
        <div className="max-w-xs mb-4">
          <Field label="Turma">
            <SelectInput value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">— Selecione —</option>
              {(turmas || []).map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
      )}

      {alunosVisiveis.length === 0 ? (
        <div className="text-sm text-inkSoft italic">
          {souAluno ? "Nenhuma nota lançada ainda." : "Nenhum aluno nesta turma ainda."}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-inkSoft border-b border-line">
                <th className="py-2 pr-3 whitespace-nowrap">Aluno</th>
                {MODULOS_AVALIAVEIS.map((m) => (
                  <th key={m.id} className="py-2 px-2 text-center whitespace-nowrap">{m.label}</th>
                ))}
                <th className="py-2 pl-3 text-center whitespace-nowrap">Média</th>
              </tr>
            </thead>
            <tbody>
              {alunosVisiveis.map((aluno) => {
                const media = mediaDoAluno(aluno.uid);
                return (
                  <tr key={aluno.uid} className="border-b border-line/50">
                    <td className="py-1.5 pr-3 whitespace-nowrap font-semibold text-ink">{aluno.nome}</td>
                    {MODULOS_AVALIAVEIS.map((modulo) => {
                      const chave = `${aluno.uid}__${modulo.id}`;
                      const n = notaDe(aluno.uid, modulo.id);
                      const podeEditar = !souAluno;
                      return (
                        <td key={modulo.id} className="py-1.5 px-2 text-center">
                          {editando === chave ? (
                            <input
                              autoFocus
                              className="w-14 border border-line rounded px-1 py-0.5 text-center text-xs"
                              value={valorEdicao}
                              onChange={(e) => setValorEdicao(e.target.value)}
                              onBlur={() => salvarNota(aluno, modulo)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") salvarNota(aluno, modulo);
                                if (e.key === "Escape") setEditando(null);
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              disabled={!podeEditar}
                              onClick={() => {
                                setEditando(chave);
                                setValorEdicao(n ? String(n.nota) : "");
                              }}
                              className={
                                "w-10 py-0.5 rounded text-xs font-semibold " +
                                (n ? "bg-green/10 text-green" : "bg-paper text-inkSoft") +
                                (podeEditar ? " hover:opacity-70 cursor-pointer" : " cursor-default")
                              }
                            >
                              {n ? numFmt(n.nota) : "—"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1.5 pl-3 text-center font-semibold text-ink">
                      {media !== null ? numFmt(media) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// SUPORTE — chamados "Sistema" (para um Usuário Mestre) e "Suporte Pedagógico"
// (para o Professor). Lista compartilhada (kv: "chamados"), com status
// controlado por Mestre/Professor; Aluno só vê e abre os próprios chamados.
// ============================================================================

const STATUS_CHAMADO_OPCOES = ["Aberto", "Em análise", "Encaminhado para desenvolvimento", "Encerrado"];

function PillStatusChamado({ status }) {
  const tone = status === "Encerrado" ? "default" : status === "Encaminhado para desenvolvimento" ? "green" : "gold";
  return <Pill tone={tone}>{status}</Pill>;
}

function GestaoSuporteView({ perfil, chamados, salvarChamados, registrarAuditoria }) {
  const [aba, setAba] = useState("sistema"); // sistema | pedagogico
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [selecionados, setSelecionados] = useState(null); // null = "todos selecionados" (ainda não mexeu)

  const souAluno = perfil?.tipo === "Aluno";
  const podeGerenciarStatus = perfil?.tipo === "Mestre" || perfil?.tipo === "Professor";

  const listaDaAba = (chamados || []).filter((c) => c.tipo === aba);
  const listaVisivel = souAluno ? listaDaAba.filter((c) => c.autorUid === perfil.uid) : listaDaAba;
  const listaFiltrada =
    !souAluno && filtroStatus !== "Todos" ? listaVisivel.filter((c) => c.status === filtroStatus) : listaVisivel;
  const ordenada = [...listaFiltrada].sort((a, b) => b.criadoEm - a.criadoEm);

  const estaSelecionado = (id) => selecionados === null || selecionados.has(id);
  const alternarSelecao = (id) => {
    setSelecionados((atual) => {
      const base = atual === null ? new Set(ordenada.map((c) => c.id)) : new Set(atual);
      if (base.has(id)) base.delete(id);
      else base.add(id);
      return base;
    });
  };
  const selecionarTodos = () => setSelecionados(new Set(ordenada.map((c) => c.id)));
  const limparSelecao = () => setSelecionados(new Set());

  const abrirChamado = async (e) => {
    e.preventDefault();
    if (!assunto.trim() || !descricao.trim()) {
      setErro("Preencha o assunto e a descrição.");
      return;
    }
    setErro("");
    const novo = {
      id: uid("chm"),
      tipo: aba,
      assunto: assunto.trim(),
      descricao: descricao.trim(),
      autorUid: perfil.uid,
      autorNome: perfil.nome,
      autorTipo: perfil.tipo,
      status: "Aberto",
      criadoEm: Date.now(),
    };
    await salvarChamados([...(chamados || []), novo]);
    await registrarAuditoria(
      "criar",
      "sistema",
      `Abriu um chamado de suporte (${aba === "sistema" ? "Sistema" : "Suporte Pedagógico"}): "${novo.assunto}"`
    );
    setAssunto("");
    setDescricao("");
    setMostrarForm(false);
  };

  const mudarStatus = async (chamado, novoStatus) => {
    await salvarChamados((chamados || []).map((c) => (c.id === chamado.id ? { ...c, status: novoStatus } : c)));
    await registrarAuditoria("editar", "sistema", `Alterou o status do chamado "${chamado.assunto}" para "${novoStatus}"`);
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Central de Suporte</h2>
      <p className="text-sm text-inkSoft mb-4">
        {aba === "sistema"
          ? "Fale com um Usuário Mestre sobre dúvidas, problemas ou sugestões da plataforma."
          : "Converse com o(a) professor(a) sobre dúvidas da matéria ou do seu trabalho na empresa."}
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4 max-w-sm">
        <button
          type="button"
          onClick={() => { setAba("sistema"); setMostrarForm(false); setFiltroStatus("Todos"); }}
          className={
            "px-3 py-2 rounded-lg text-sm font-semibold border transition-colors " +
            (aba === "sistema" ? "bg-green text-white border-green" : "border-line text-inkSoft hover:text-ink")
          }
        >
          Sistema
        </button>
        <button
          type="button"
          onClick={() => { setAba("pedagogico"); setMostrarForm(false); setFiltroStatus("Todos"); }}
          className={
            "px-3 py-2 rounded-lg text-sm font-semibold border transition-colors " +
            (aba === "pedagogico" ? "bg-green text-white border-green" : "border-line text-inkSoft hover:text-ink")
          }
        >
          Suporte Pedagógico
        </button>
      </div>

      {!souAluno && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {["Todos", ...STATUS_CHAMADO_OPCOES].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={
                "px-3 py-1 rounded-full text-xs font-semibold border transition-colors " +
                (filtroStatus === s ? "bg-green text-white border-green" : "border-line text-inkSoft hover:text-ink")
              }
            >
              {s}
            </button>
          ))}
          <div className="flex-1" />
          <Botao variant="ghost" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / Salvar PDF
          </Botao>
        </div>
      )}
      {!souAluno && ordenada.length > 0 && (
        <div className="flex items-center gap-3 mb-4 text-xs text-inkSoft">
          <span>
            {ordenada.filter((c) => estaSelecionado(c.id)).length} de {ordenada.length} selecionado(s) para
            impressão/PDF
          </span>
          <button onClick={selecionarTodos} className="text-green underline decoration-dotted hover:opacity-70">
            Selecionar todos
          </button>
          <button onClick={limparSelecao} className="text-green underline decoration-dotted hover:opacity-70">
            Limpar seleção
          </button>
        </div>
      )}

      {!mostrarForm ? (
        <Botao onClick={() => setMostrarForm(true)} className="mb-4">
          <Plus size={16} /> Novo chamado
        </Botao>
      ) : (
        <Card className="mb-4">
          <h3 className="font-semibold text-ink text-sm mb-1">Novo chamado</h3>
          <p className="text-xs text-inkSoft mb-3">
            Sua mensagem vai para {aba === "sistema" ? "um Usuário Mestre" : "o(a) professor(a)"}.
          </p>
          <form onSubmit={abrirChamado}>
            <Field label="Assunto">
              <TxtInput value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Resuma em poucas palavras" />
            </Field>
            <Field label="Descrição">
              <textarea
                className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green/30"
                rows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva com o máximo de detalhes possível…"
              />
            </Field>
            {erro && <div className="text-sm text-red mb-3">{erro}</div>}
            <div className="flex gap-2">
              <Botao type="submit">Abrir chamado</Botao>
              <Botao type="button" variant="ghost" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {(() => {
          const idsSelecionados = ordenada.filter((c) => estaSelecionado(c.id)).map((c) => c.id);
          const ultimoSelecionadoId = idsSelecionados[idsSelecionados.length - 1];
          return ordenada.map((c) => {
            const selecionado = estaSelecionado(c.id);
            const naoEhOUltimo = selecionado && c.id !== ultimoSelecionadoId;
            return (
              <Card
                key={c.id}
                className={
                  (selecionado ? "" : "print:hidden") +
                  (naoEhOUltimo ? " print:break-after-page print:pb-8" : "") +
                  " print:break-inside-avoid"
                }
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {!souAluno && (
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => alternarSelecao(c.id)}
                        className="mt-1 print:hidden"
                        title="Incluir na impressão/PDF"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-ink text-sm">{c.assunto}</div>
                      <div className="text-xs text-inkSoft">
                        {c.autorNome} ({c.autorTipo}) · {fmtDateTime(c.criadoEm)}
                      </div>
                      <p className="text-sm text-inkSoft mt-1 whitespace-pre-wrap">{c.descricao}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {podeGerenciarStatus ? (
                      <SelectInput value={c.status} onChange={(e) => mudarStatus(c, e.target.value)}>
                        {STATUS_CHAMADO_OPCOES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </SelectInput>
                    ) : (
                      <PillStatusChamado status={c.status} />
                    )}
                  </div>
                </div>
              </Card>
            );
          });
        })()}
        {ordenada.length === 0 && (
          <div className="text-sm text-inkSoft italic">
            Nenhum chamado {filtroStatus !== "Todos" ? `com status "${filtroStatus}" ` : ""}por aqui ainda.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GESTÃO — USUÁRIOS (e Aprovações)
// ============================================================================

function PainelPermissoes({ usuario, onSalvar, onFechar }) {
  const [permissoes, setPermissoes] = useState(usuario.permissoes || defaultPermissoes(usuario.tipo));
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <Card className="w-full max-w-sm">
        <h3 className="font-serif font-semibold text-ink mb-3">Permissões de {usuario.nome}</h3>
        <div className="space-y-2 mb-4">
          {Object.keys(PERMISSAO_LABELS).map((flag) => (
            <label key={flag} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={!!permissoes[flag]}
                onChange={(e) => setPermissoes({ ...permissoes, [flag]: e.target.checked })}
              />
              {PERMISSAO_LABELS[flag]}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Botao
            onClick={async () => {
              await onSalvar(permissoes);
              onFechar();
            }}
          >
            Salvar
          </Botao>
          <Botao variant="ghost" onClick={onFechar}>
            Cancelar
          </Botao>
        </div>
      </Card>
    </div>
  );
}

function GestaoUsuariosView({ perfil, usuarios, turmas, recarregar, registrarAuditoria }) {
  const [editandoPermissoesUid, setEditandoPermissoesUid] = useState(null);
  const [editandoTurmaUid, setEditandoTurmaUid] = useState(null);
  const podeExcluir = !!perfil?.permissoes?.excluirUsuarios;
  const souMestre = perfil?.tipo === "Mestre";

  const contarMestres = () => (usuarios || []).filter((u) => u.tipo === "Mestre" && u.aprovado).length;

  const mudarTipo = async (usuario, novoTipo) => {
    if (usuario.tipo === "Mestre" && novoTipo !== "Mestre" && contarMestres() <= 1) {
      alert("Não é possível rebaixar o único Usuário Mestre restante.");
      return;
    }
    await atualizarUsuario(usuario.uid, { tipo: novoTipo, permissoes: defaultPermissoes(novoTipo) });
    await registrarAuditoria("editar", "usuario", `Mudou o tipo de "${usuario.nome}" de ${usuario.tipo} para ${novoTipo}`);
    recarregar();
  };

  const mudarTurma = async (usuario, turmaId) => {
    await atualizarUsuario(usuario.uid, { turmaId: turmaId || null });
    const nomeNovaTurma = (turmas || []).find((t) => t.id === turmaId)?.nome || "—";
    await registrarAuditoria("editar", "usuario", `Mudou a turma de "${usuario.nome}" para "${nomeNovaTurma}"`);
    setEditandoTurmaUid(null);
    recarregar();
  };

  const excluir = async (usuario) => {
    if (!podeExcluir) {
      alert("Você não tem permissão para excluir usuários.");
      return;
    }
    if (usuario.tipo === "Mestre" && contarMestres() <= 1) {
      alert("Não é possível excluir o único Usuário Mestre restante.");
      return;
    }
    if (!confirm(`Excluir a conta de "${usuario.nome}"? Esta ação não pode ser desfeita.`)) return;
    await excluirUsuarioDoc(usuario.uid);
    await registrarAuditoria("excluir", "usuario", `Excluiu a conta de "${usuario.nome}"`);
    recarregar();
  };

  const turmaNome = (id) => (turmas || []).find((t) => t.id === id)?.nome || "—";

  const aprovados = (usuarios || []).filter((u) => u.aprovado);

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Usuários</h2>
      <p className="text-sm text-inkSoft mb-4">
        Todas as contas aprovadas do sistema, com turma, tipo e permissões de cada uma.
      </p>

      <div className="space-y-2">
        {aprovados.map((u) => (
          <Card key={u.uid}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-ink text-sm flex items-center gap-2">
                  {u.nome}
                  <Pill tone={u.tipo === "Mestre" ? "gold" : "green"}>{u.tipo}</Pill>
                </div>
                <div className="text-xs text-inkSoft">{u.email}</div>
                <div className="text-xs text-inkSoft">
                  Turma:{" "}
                  {editandoTurmaUid === u.uid ? (
                    <select
                      autoFocus
                      defaultValue={u.turmaId || ""}
                      onChange={(e) => mudarTurma(u, e.target.value)}
                      onBlur={() => setEditandoTurmaUid(null)}
                      className="border border-line rounded px-1 py-0.5 text-xs"
                    >
                      <option value="">—</option>
                      {(turmas || []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditandoTurmaUid(u.uid)}
                      className="underline decoration-dotted"
                    >
                      {turmaNome(u.turmaId)}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {souMestre && (
                  <select
                    value={u.tipo}
                    onChange={(e) => mudarTipo(u, e.target.value)}
                    className="border border-line rounded px-2 py-1 text-xs"
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                {souMestre && (
                  <Botao variant="ghost" onClick={() => setEditandoPermissoesUid(u.uid)}>
                    <ShieldCheck size={14} /> Permissões
                  </Botao>
                )}
                {podeExcluir && (
                  <button onClick={() => excluir(u)} className="text-red hover:opacity-70" title="Excluir">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editandoPermissoesUid && (
        <PainelPermissoes
          usuario={aprovados.find((u) => u.uid === editandoPermissoesUid)}
          onFechar={() => setEditandoPermissoesUid(null)}
          onSalvar={async (permissoes) => {
            const alvo = aprovados.find((u) => u.uid === editandoPermissoesUid);
            await atualizarUsuario(editandoPermissoesUid, { permissoes });
            await registrarAuditoria("editar", "usuario", `Alterou as permissões de "${alvo?.nome}"`);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function GestaoAprovacoesView({ usuarios, turmas, recarregar, registrarAuditoria }) {
  const pendentes = (usuarios || []).filter((u) => !u.aprovado);
  const turmaNome = (id) => (turmas || []).find((t) => t.id === id)?.nome || "—";

  const aprovar = async (u) => {
    await atualizarUsuario(u.uid, { aprovado: true });
    await registrarAuditoria("editar", "usuario", `Aprovou o cadastro de "${u.nome}" (${u.tipo})`);
    recarregar();
  };

  const rejeitar = async (u) => {
    if (!confirm(`Rejeitar e excluir o cadastro de "${u.nome}"?`)) return;
    await excluirUsuarioDoc(u.uid);
    await registrarAuditoria("excluir", "usuario", `Rejeitou o cadastro de "${u.nome}"`);
    recarregar();
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Aprovações pendentes</h2>
      <p className="text-sm text-inkSoft mb-4">Novos cadastros de alunos e professores aguardando sua aprovação.</p>

      {pendentes.length === 0 && <div className="text-sm text-inkSoft italic">Nenhum cadastro pendente.</div>}

      <div className="space-y-2">
        {pendentes.map((u) => (
          <Card key={u.uid} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-ink text-sm flex items-center gap-2">
                {u.nome} <Pill tone="gold">{u.tipo}</Pill>
              </div>
              <div className="text-xs text-inkSoft">{u.email}</div>
              <div className="text-xs text-inkSoft">
                Turma: {turmaNome(u.turmaId)} · Cadastrado em {fmtDateTime(u.criadoEm)}
              </div>
            </div>
            <div className="flex gap-2">
              <Botao onClick={() => aprovar(u)}>
                <UserCheck size={16} /> Aprovar
              </Botao>
              <Botao variant="danger" onClick={() => rejeitar(u)}>
                <UserX size={16} /> Rejeitar
              </Botao>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// APP RAIZ
// ============================================================================

function Dashboard({ user, perfil, recarregarPerfil }) {
  const [aba, setAbaBase] = useState("capa");
  const [historicoAbas, setHistoricoAbas] = useState([]);

  // Navegação com histórico: cada troca de tela empilha a tela anterior, para
  // o botão "Voltar" (visível em todas as telas, exceto no Início) funcionar
  // em qualquer sequência de cliques no menu.
  const setAba = useCallback((novaAba) => {
    setAbaBase((abaAtual) => {
      if (novaAba !== abaAtual) setHistoricoAbas((h) => [...h, abaAtual]);
      return novaAba;
    });
  }, []);
  const voltar = useCallback(() => {
    setHistoricoAbas((h) => {
      if (h.length === 0) return h;
      const anterior = h[h.length - 1];
      setAbaBase(anterior);
      return h.slice(0, -1);
    });
  }, []);

  const [turmas, salvarTurmas, recarregarTurmas] = useSharedList("turmas");
  const [empresas, salvarEmpresas, recarregarEmpresas] = useSharedList("empresas");
  const [refreshUsuarios, setRefreshUsuarios] = useState(0);
  const usuarios = useListaUsuarios(refreshUsuarios);
  const recarregarUsuarios = useCallback(() => setRefreshUsuarios((k) => k + 1), []);

  // Plano de Contas (editável) — "semeado" a partir de contas.js na primeira
  // vez que alguém salva uma alteração; até lá, usa a lista padrão do curso.
  // Cada edição/inclusão/exclusão gera uma entrada de auditoria abaixo.
  const [planoContasSalvo, salvarPlanoContas] = useSharedList("plano_contas", CONTAS);
  const contasAtivas = planoContasSalvo && planoContasSalvo.length ? planoContasSalvo : CONTAS;
  const leavesAtivas = contasAtivas.filter((c) => c.aceitaLancamento);
  const contaByCodeAtivo = {};
  contasAtivas.forEach((c) => {
    contaByCodeAtivo[c.codigo] = c;
  });

  const [auditoria, salvarAuditoria] = useSharedList("auditoria", []);
  const [chamados, salvarChamados] = useSharedList("chamados", []);
  const [notas, salvarNotas] = useSharedList("notas", []);
  // Prazos das Atividades Avaliativas (por turma + módulo) e liberações
  // excepcionais individuais concedidas pelo professor — Fase 6.
  const [prazosAtividades, salvarPrazosAtividades] = useSharedList("prazos_atividades", []);
  const [liberacoesExcecao, salvarLiberacoesExcecao] = useSharedList("liberacoes_excecao", []);
  const registrarAuditoria = useCallback(
    async (acao, entidade, descricao) => {
      const entrada = {
        id: uid("log"),
        timestamp: Date.now(),
        usuarioId: perfil?.uid,
        usuarioNome: perfil?.nome,
        acao,
        entidade,
        descricao,
      };
      const novo = [entrada, ...(auditoria || [])].slice(0, 1000);
      await salvarAuditoria(novo);
    },
    [auditoria, perfil, salvarAuditoria]
  );

  // Empresa ativa (Fase 2) — Saldos, Lançamentos e Consulta trabalham sempre
  // com os dados desta empresa. Escolha válida apenas durante a sessão atual.
  // Aluno só pode escolher/ver a empresa vinculada a ele (Fase 2.1 — visibilidade).
  const empresasVisiveis =
    perfil?.tipo === "Aluno" ? (empresas || []).filter((e) => e.alunoId === perfil.uid) : empresas || [];
  const [empresaAtivaId, setEmpresaAtivaId] = useState(null);
  const empresaAtiva = empresasVisiveis.find((e) => e.id === empresaAtivaId) || null;
  const [saldos, salvarSaldos] = useSharedList(empresaAtivaId ? `saldos_${empresaAtivaId}` : null, {});
  const [lancamentos, salvarLancamentos] = useSharedList(
    empresaAtivaId ? `lancamentos_${empresaAtivaId}` : null,
    []
  );

  const moduloFuturo = MODULOS_FUTUROS.find((m) => m.id === aba);

  const contagens = {
    turmas: (turmas || []).length,
    empresas: (empresas || []).length,
    usuarios: (usuarios || []).filter((u) => u.aprovado).length,
    pendentes: (usuarios || []).filter((u) => !u.aprovado).length,
  };

  return (
    <Layout perfil={perfil} aba={aba} setAba={setAba} podeVoltar={historicoAbas.length > 0} aoVoltar={voltar}>
      {aba === "capa" && <Capa perfil={perfil} setAba={setAba} contagens={contagens} />}
      {aba === "turmas" && (
        <GestaoTurmasView
          perfil={perfil}
          turmas={turmas}
          salvarTurmas={salvarTurmas}
          recarregarTurmas={recarregarTurmas}
          usuarios={usuarios}
          empresas={empresas}
          recarregarUsuarios={recarregarUsuarios}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {aba === "empresas" && (
        <GestaoEmpresasView
          perfil={perfil}
          empresas={empresas}
          salvarEmpresas={salvarEmpresas}
          usuarios={usuarios}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {aba === "usuarios" && perfil?.tipo !== "Aluno" && (
        <GestaoUsuariosView
          perfil={perfil}
          usuarios={usuarios}
          turmas={turmas}
          recarregar={recarregarUsuarios}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {aba === "aprovacoes" && (
        <GestaoAprovacoesView
          usuarios={usuarios}
          turmas={turmas}
          recarregar={recarregarUsuarios}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {aba === "plano-contas" && (
        <GestaoPlanoContasView
          perfil={perfil}
          contas={contasAtivas}
          salvarPlanoContas={salvarPlanoContas}
          auditoria={auditoria}
          registrarAuditoria={registrarAuditoria}
          empresas={empresas}
          notas={notas}
          salvarNotas={salvarNotas}
          turmas={turmas}
          usuarios={usuarios}
          prazosAtividades={prazosAtividades}
          salvarPrazosAtividades={salvarPrazosAtividades}
          liberacoesExcecao={liberacoesExcecao}
          salvarLiberacoesExcecao={salvarLiberacoesExcecao}
        />
      )}
      {aba === "saldos" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoSaldosView
            empresa={empresaAtiva}
            saldos={saldos}
            salvarSaldos={salvarSaldos}
            leaves={leavesAtivas}
            registrarAuditoria={registrarAuditoria}
          />
        </>
      )}
      {aba === "lancamentos" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoLancamentosView
            empresa={empresaAtiva}
            perfil={perfil}
            lancamentos={lancamentos}
            salvarLancamentos={salvarLancamentos}
            leaves={leavesAtivas}
            contaByCode={contaByCodeAtivo}
            registrarAuditoria={registrarAuditoria}
          />
        </>
      )}
      {aba === "razao" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoConsultaView
            empresa={empresaAtiva}
            lancamentos={lancamentos}
            saldos={saldos}
            leaves={leavesAtivas}
            contaByCode={contaByCodeAtivo}
          />
        </>
      )}
      {aba === "balancete" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoBalanceteView
            empresa={empresaAtiva}
            lancamentos={lancamentos}
            saldos={saldos}
            leaves={leavesAtivas}
            contaByCode={contaByCodeAtivo}
            perfil={perfil}
            empresas={empresas}
            notas={notas}
            salvarNotas={salvarNotas}
            registrarAuditoria={registrarAuditoria}
          />
        </>
      )}
      {aba === "dre" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoDREView
            empresa={empresaAtiva}
            lancamentos={lancamentos}
            saldos={saldos}
            perfil={perfil}
            empresas={empresas}
            notas={notas}
            salvarNotas={salvarNotas}
            registrarAuditoria={registrarAuditoria}
          />
        </>
      )}
      {aba === "encerramento" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoEncerramentoView
            empresa={empresaAtiva}
            lancamentos={lancamentos}
            saldos={saldos}
            perfil={perfil}
            salvarLancamentos={salvarLancamentos}
            registrarAuditoria={registrarAuditoria}
            leaves={leavesAtivas}
            contaByCode={contaByCodeAtivo}
          />
        </>
      )}
      {aba === "balanco" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoBalancoView empresa={empresaAtiva} lancamentos={lancamentos} saldos={saldos} contas={contasAtivas} />
        </>
      )}
      {aba === "relatorios" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoRelatoriosView
            perfil={perfil}
            empresa={empresaAtiva}
            empresaAtivaId={empresaAtivaId}
            lancamentos={lancamentos}
            saldos={saldos}
            leaves={leavesAtivas}
            contaByCode={contaByCodeAtivo}
            empresasParaComparar={empresasVisiveis}
          />
        </>
      )}
      {aba === "estoque" && (
        <>
          <SeletorEmpresaAtiva empresas={empresasVisiveis} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoEstoqueView
            empresa={empresaAtiva}
            lancamentos={lancamentos}
            contaByCode={contaByCodeAtivo}
            perfil={perfil}
            empresas={empresas}
            notas={notas}
            salvarNotas={salvarNotas}
            registrarAuditoria={registrarAuditoria}
          />
        </>
      )}
      {aba === "introducao" && (
        <GestaoIntroducaoView
          contas={contasAtivas}
          perfil={perfil}
          empresas={empresas}
          notas={notas}
          salvarNotas={salvarNotas}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {aba === "manual" && <GestaoManualView />}
      {aba === "manual-professor" && perfil?.tipo !== "Aluno" && <GestaoManualProfessorView />}
      {aba === "manual-operacionalizacao" && perfil?.tipo === "Mestre" && <GestaoManualOperacionalizacaoView />}
      {aba === "checklist-dev" && perfil?.tipo === "Mestre" && <GestaoChecklistDevView />}
      {aba === "auditoria" && <GestaoAuditoriaView perfil={perfil} auditoria={auditoria} />}
      {aba === "backup" && (
        <GestaoBackupView
          perfil={perfil}
          turmas={turmas}
          empresas={empresas}
          usuarios={usuarios}
          auditoria={auditoria}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {aba === "notas" && (
        <GestaoNotasView
          perfil={perfil}
          turmas={turmas}
          usuarios={usuarios}
          empresas={empresas}
          notas={notas}
          salvarNotas={salvarNotas}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {aba === "suporte" && (
        <GestaoSuporteView
          perfil={perfil}
          chamados={chamados}
          salvarChamados={salvarChamados}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {moduloFuturo && <ModuloEmBreve modulo={moduloFuturo} />}
    </Layout>
  );
}

function AppInterno() {
  const [user, setUser] = useState(undefined);
  const [turmas, , recarregarTurmasApp] = useSharedList("turmas");
  const [empresas, salvarEmpresas, recarregarEmpresasApp] = useSharedList("empresas");
  const [perfil, recarregarPerfil] = useUsuario(user?.uid);
  // Acesso Mestre é revalidado a cada entrada — nunca fica salvo entre sessões.
  const [mestreDesbloqueado, setMestreDesbloqueado] = useState(false);
  // Idem para Aluno: a matrícula é confirmada de novo a cada entrada, por
  // segurança (chamado de suporte "Login + matrícula").
  const [alunoDesbloqueado, setAlunoDesbloqueado] = useState(false);

  useEffect(() => {
    const unsub = observarSessao((u) => {
      setUser(u || null);
      setMestreDesbloqueado(false);
      setAlunoDesbloqueado(false);
    });
    return () => unsub();
  }, []);

  // Sempre que a sessão muda (login, logout, troca de conta), busca turmas e
  // empresas de novo — sem isso, quem loga logo depois de outra pessoa ter
  // cadastrado algo na mesma aba do navegador via uma lista desatualizada
  // (ex.: aluno cadastrado pelo professor na mesma sessão do navegador).
  useEffect(() => {
    if (user) {
      recarregarTurmasApp();
      recarregarEmpresasApp();
    }
  }, [user?.uid]);

  if (user === undefined) return <LoadingScreen texto="Verificando sessão…" />;

  if (!user) return <TelaLogin />;

  if (perfil === undefined) return <LoadingScreen texto="Carregando seu perfil…" />;

  if (perfil === null) {
    return (
      <TelaCompletarCadastroGoogle
        user={user}
        turmas={turmas}
        empresas={empresas}
        salvarEmpresas={salvarEmpresas}
        onConcluido={recarregarPerfil}
      />
    );
  }

  if (!perfil.aprovado) return <TelaAguardandoAprovacao perfil={perfil} />;

  if (perfil.tipo === "Mestre" && !mestreDesbloqueado) {
    return <TelaSenhaMestre onDesbloquear={() => setMestreDesbloqueado(true)} />;
  }

  if (perfil.tipo === "Aluno" && !alunoDesbloqueado) {
    return <TelaConfirmarMatricula perfil={perfil} onDesbloquear={() => setAlunoDesbloqueado(true)} />;
  }

  return <Dashboard user={user} perfil={perfil} recarregarPerfil={recarregarPerfil} />;
}

// Rede de segurança: se qualquer tela do sistema quebrar por um erro
// inesperado, mostra uma mensagem com opção de recarregar — em vez da
// página ficar completamente em branco, sem nenhuma pista do que houve.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { temErro: false, erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { temErro: true, erro };
  }

  componentDidCatch(erro, infoComponente) {
    console.error("Erro capturado pelo sistema:", erro, infoComponente);
  }

  render() {
    if (this.state.temErro) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-paper px-4">
          <div className="max-w-md text-center">
            <IconeApp tamanho="w-16 h-16" iconeTamanho={30} className="mx-auto mb-4" />
            <h1 className="text-lg font-serif font-semibold text-ink mb-2">Algo deu errado</h1>
            <p className="text-sm text-inkSoft mb-4">
              Aconteceu um erro inesperado nesta tela. Tente recarregar a página — se acontecer de novo,
              tire um print desta mensagem (com o texto técnico abaixo) e avise um Administrador.
            </p>
            <Botao onClick={() => window.location.reload()}>Recarregar página</Botao>
            {this.state.erro && (
              <pre className="text-xs text-left text-red bg-red/5 border border-red/20 rounded-lg p-3 mt-4 overflow-auto max-h-48 whitespace-pre-wrap">
                {String(this.state.erro?.message || this.state.erro)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInterno />
    </ErrorBoundary>
  );
}
