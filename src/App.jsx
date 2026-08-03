import { useState, useEffect, useCallback, useRef } from "react";
import {
  Menu, X, LogOut, School, Users, Building2, LayoutDashboard, BookOpen,
  ClipboardList, FileBarChart, ScrollText, History, Save, Eye, EyeOff,
  Crown, UserCheck, UserX, Pencil, Trash2, Plus, ShieldCheck, Wallet,
  Landmark, GraduationCap, Layers,
} from "lucide-react";
import {
  observarSessao, cadastrar, entrar, sair, recuperarSenha, traduzErroAuth, CODIGO_MESTRE,
} from "./firebaseAuth";
import { LOGO_CEDUP } from "./logo";
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
const MODULOS_FUTUROS = [
  { id: "introducao", label: "Introdução à Contabilidade", icon: GraduationCap, fase: 4 },
  { id: "manual", label: "Manual do Aluno", icon: BookOpen, fase: 4 },
  { id: "relatorios", label: "Relatórios", icon: FileBarChart, fase: 5 },
  { id: "backup", label: "Backup", icon: Save, fase: 5 },
];

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
  { id: "balancete", label: "Balancete de Verificação", icon: ClipboardList },
  { id: "dre", label: "DRE", icon: FileBarChart },
  { id: "encerramento", label: "Encerramento (ARE)", icon: History },
  { id: "balanco", label: "Balanço Patrimonial", icon: Landmark },
];

// ============================================================================
// HELPERS
// ============================================================================

const uid = (prefixo) => prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fmtDateTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR");
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

function Pill({ children, tone = "green" }) {
  const tons = {
    green: "bg-green/10 text-green border-green/30",
    gold: "bg-gold/10 text-gold border-gold/30",
    red: "bg-red/10 text-red border-red/30",
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
        <img src={LOGO_CEDUP} alt="CEDUP Hermann Hering" className="w-16 h-16 mx-auto mb-4 rounded-lg" />
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

function TelaLogin({ onIrParaCadastro }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagemRecuperar, setMensagemRecuperar] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (err) {
      setErro(traduzErroAuth(err.code));
    } finally {
      setCarregando(false);
    }
  };

  const handleRecuperar = async () => {
    if (!email.trim()) {
      setErro("Digite seu e-mail no campo acima antes de clicar em \"Esqueci minha senha\".");
      return;
    }
    try {
      await recuperarSenha(email.trim());
      setMensagemRecuperar("Enviamos um link de redefinição de senha para o seu e-mail.");
    } catch (err) {
      setErro(traduzErroAuth(err.code));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={LOGO_CEDUP} alt="CEDUP Hermann Hering" className="w-16 h-16 mx-auto mb-3 rounded-lg" />
          <h1 className="text-xl font-serif font-semibold text-ink">Sistema de Escrituração Contábil</h1>
          <p className="text-xs text-inkSoft mt-1">CEDUP Hermann Hering · Curso Técnico em Contabilidade</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="E-mail">
              <TxtInput
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </Field>
            <Field label="Senha">
              <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
            </Field>
            {erro && <div className="text-sm text-red mb-3">{erro}</div>}
            {mensagemRecuperar && <div className="text-sm text-green mb-3">{mensagemRecuperar}</div>}
            <Botao type="submit" disabled={carregando} className="w-full justify-center">
              {carregando ? "Entrando…" : "Entrar"}
            </Botao>
          </form>
          <button
            onClick={handleRecuperar}
            className="text-xs text-inkSoft hover:text-ink underline block mt-3 mx-auto"
          >
            Esqueci minha senha
          </button>
        </Card>
        <button
          onClick={onIrParaCadastro}
          className="text-sm text-ink font-semibold underline block mt-4 mx-auto"
        >
          Ainda não tenho conta — cadastrar
        </button>
      </div>
    </div>
  );
}

function TelaCadastro({ turmas, onIrParaLogin }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [papel, setPapel] = useState("Aluno");
  const [turmaId, setTurmaId] = useState("");
  const [codigoMestre, setCodigoMestre] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (papel === "Aluno" && !turmaId) {
      setErro("Selecione sua turma. Se ela ainda não aparece na lista, peça ao professor(a) para cadastrá-la antes.");
      return;
    }
    setCarregando(true);
    try {
      const virouMestre = codigoMestre.trim() && codigoMestre.trim() === CODIGO_MESTRE;
      const tipoFinal = virouMestre ? "Mestre" : papel;
      const user = await cadastrar(nome.trim(), email.trim(), senha);
      const perfil = {
        uid: user.uid,
        nome: nome.trim(),
        email: email.trim(),
        tipo: tipoFinal,
        turmaId: turmaId || null,
        permissoes: defaultPermissoes(tipoFinal),
        aprovado: virouMestre,
        criadoEm: Date.now(),
      };
      await salvarUsuario(perfil);
    } catch (err) {
      setErro(traduzErroAuth(err.code));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={LOGO_CEDUP} alt="CEDUP Hermann Hering" className="w-16 h-16 mx-auto mb-3 rounded-lg" />
          <h1 className="text-xl font-serif font-semibold text-ink">Criar conta</h1>
          <p className="text-xs text-inkSoft mt-1">Sistema de Escrituração Contábil</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Nome completo">
              <TxtInput required value={nome} onChange={(e) => setNome(e.target.value)} />
            </Field>
            <Field label="E-mail">
              <TxtInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha">
              <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mín. 6 caracteres" />
            </Field>
            <Field label="Confirmar senha">
              <CampoSenha value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </Field>
            <Field label="Você é">
              <SelectInput value={papel} onChange={(e) => setPapel(e.target.value)}>
                <option value="Aluno">Aluno</option>
                <option value="Professor">Professor</option>
              </SelectInput>
            </Field>
            <Field
              label="Turma"
              hint={
                papel === "Aluno"
                  ? "Obrigatório para alunos — só é possível escolher uma turma já cadastrada pelo professor."
                  : "Opcional para professores — pode ser definida depois."
              }
            >
              <SelectInput value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
                <option value="">— Selecione —</option>
                {(turmas || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Código de Mestre (opcional)" hint="Só preencha se um Usuário Mestre te passou este código.">
              <TxtInput value={codigoMestre} onChange={(e) => setCodigoMestre(e.target.value)} />
            </Field>
            {erro && <div className="text-sm text-red mb-3">{erro}</div>}
            <Botao type="submit" disabled={carregando} className="w-full justify-center">
              {carregando ? "Criando conta…" : "Criar conta"}
            </Botao>
          </form>
        </Card>
        <button onClick={onIrParaLogin} className="text-sm text-ink font-semibold underline block mt-4 mx-auto">
          Já tenho conta — entrar
        </button>
      </div>
    </div>
  );
}

function TelaAguardandoAprovacao({ perfil }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm text-center">
        <img src={LOGO_CEDUP} alt="CEDUP Hermann Hering" className="w-16 h-16 mx-auto mb-4 rounded-lg" />
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

function Layout({ perfil, aba, setAba, children }) {
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
          <img src={LOGO_CEDUP} alt="CEDUP Hermann Hering" className="w-10 h-10 rounded-lg" />
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

          <div className="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">
            Módulos (próximas fases)
          </div>
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
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

function Capa({ perfil, setAba, contagens }) {
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

      <Card>
        <h3 className="font-serif font-semibold text-ink mb-3">Módulos disponíveis nesta fase</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {GESTAO_ITENS.map((item) => (
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

function GestaoTurmasView({ perfil, turmas, salvarTurmas, recarregarTurmas, usuarios }) {
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const podeGerenciar = !!perfil?.permissoes?.gerenciarTurmas;

  const criar = async () => {
    if (!novoNome.trim()) return;
    const nova = { id: uid("t"), nome: novoNome.trim(), criadoEm: Date.now() };
    await salvarTurmas([...(turmas || []), nova]);
    setNovoNome("");
  };

  const salvarEdicao = async (id) => {
    if (!nomeEdicao.trim()) return;
    await salvarTurmas((turmas || []).map((t) => (t.id === id ? { ...t, nome: nomeEdicao.trim() } : t)));
    setEditandoId(null);
  };

  const excluir = async (turma) => {
    const emUso = (usuarios || []).filter((u) => u.turmaId === turma.id);
    if (emUso.length) {
      alert(
        `Não é possível excluir esta turma: ${emUso.length} usuário(s) ainda estão vinculados a ela. Mude a turma desses usuários primeiro (no módulo Usuários) antes de excluir a turma.`
      );
      return;
    }
    if (!confirm(`Excluir a turma "${turma.nome}"? Essa ação não pode ser desfeita.`)) return;
    await salvarTurmas((turmas || []).filter((t) => t.id !== turma.id));
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Turmas</h2>
      <p className="text-sm text-inkSoft mb-4">
        Cadastre as turmas antes de os alunos se registrarem — no cadastro, eles só podem escolher uma turma
        já existente aqui.
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
          Você não tem permissão para cadastrar, editar ou excluir turmas. Peça a um usuário <b>Mestre</b> ou{" "}
          <b>Professor</b>.
        </div>
      )}

      <div className="space-y-2">
        {(turmas || []).map((t) => (
          <Card key={t.id} className="flex items-center justify-between gap-3">
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
                    {(usuarios || []).filter((u) => u.turmaId === t.id).length} usuário(s) vinculado(s)
                  </div>
                </div>
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
              </>
            )}
          </Card>
        ))}
        {turmas && turmas.length === 0 && (
          <div className="text-sm text-inkSoft italic">Nenhuma turma cadastrada ainda.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GESTÃO — EMPRESAS
// ============================================================================

function GestaoEmpresasView({ perfil, empresas, salvarEmpresas }) {
  const podeExcluir = !!perfil?.permissoes?.excluirEmpresas;
  const [form, setForm] = useState({ nome: "", cnpj: "", atividade: "", responsavel: "" });
  const [editandoId, setEditandoId] = useState(null);

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    if (editandoId) {
      await salvarEmpresas((empresas || []).map((em) => (em.id === editandoId ? { ...em, ...form } : em)));
    } else {
      await salvarEmpresas([...(empresas || []), { id: uid("e"), ...form }]);
    }
    setForm({ nome: "", cnpj: "", atividade: "", responsavel: "" });
    setEditandoId(null);
  };

  const editar = (em) => {
    setEditandoId(em.id);
    setForm({ nome: em.nome, cnpj: em.cnpj || "", atividade: em.atividade || "", responsavel: em.responsavel || "" });
  };

  const excluir = async (em) => {
    if (!podeExcluir) {
      alert("Você não tem permissão para excluir empresas.");
      return;
    }
    if (!confirm(`Excluir a empresa "${em.nome}"? Esta ação não pode ser desfeita.`)) return;
    await salvarEmpresas((empresas || []).filter((x) => x.id !== em.id));
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Empresas</h2>
      <p className="text-sm text-inkSoft mb-4">
        Empresas fictícias usadas nos lançamentos e demonstrativos — cadastradas pelo professor(a) para as
        equipes praticarem.
      </p>

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
          <Field label="Responsável">
            <TxtInput value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </Field>
          <div className="sm:col-span-2 flex gap-2">
            <Botao type="submit">{editandoId ? "Salvar alterações" : "Adicionar empresa"}</Botao>
            {editandoId && (
              <Botao
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditandoId(null);
                  setForm({ nome: "", cnpj: "", atividade: "", responsavel: "" });
                }}
              >
                Cancelar
              </Botao>
            )}
          </div>
        </form>
      </Card>

      <div className="space-y-2">
        {(empresas || []).map((em) => (
          <Card key={em.id} className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-ink text-sm">{em.nome}</div>
              <div className="text-xs text-inkSoft">
                {em.cnpj || "CNPJ não informado"} · {em.atividade || "—"}
              </div>
              {em.responsavel && <div className="text-xs text-inkSoft">Responsável: {em.responsavel}</div>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => editar(em)} className="text-inkSoft hover:text-ink" title="Editar">
                <Pencil size={16} />
              </button>
              <button onClick={() => excluir(em)} className="text-red hover:opacity-70" title="Excluir">
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
        {empresas && empresas.length === 0 && (
          <div className="text-sm text-inkSoft italic">Nenhuma empresa cadastrada ainda.</div>
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

function GestaoPlanoContasView({ perfil, contas, salvarPlanoContas, auditoria, registrarAuditoria }) {
  const podeEditar = perfil?.tipo === "Mestre";
  const [filtro, setFiltro] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoCodigo, setEditandoCodigo] = useState(null); // código não muda numa edição
  const [erro, setErro] = useState("");

  const formVazio = () => ({
    codigo: "",
    nome: "",
    grupo: GRUPOS[0],
    tipo: "Conta Analítica",
    natureza: "Devedora",
    aceitaLancamento: true,
  });
  const [form, setForm] = useState(formVazio());

  const linhas = contas.filter((c) => {
    if (!filtro) return true;
    const f = filtro.toLowerCase();
    return c.codigo.toLowerCase().includes(f) || c.nome.toLowerCase().includes(f);
  });

  const iniciarNovo = () => {
    setEditandoCodigo(null);
    setForm(formVazio());
    setErro("");
    setMostrarForm(true);
  };

  const iniciarEdicao = (c) => {
    setEditandoCodigo(c.codigo);
    setForm({ codigo: c.codigo, nome: c.nome, grupo: c.grupo, tipo: c.tipo, natureza: c.natureza, aceitaLancamento: c.aceitaLancamento });
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
            <Field label="Código" hint={editandoCodigo ? "O código não pode ser alterado numa conta já existente." : 'Números separados por ponto, ex.: "1.1.1.08"'}>
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
              {podeEditar && <th className="py-2 pr-3"></th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => (
              <tr
                key={c.codigo}
                className={"border-b border-line/50 " + (c.nivel <= 2 ? "font-semibold" : "")}
              >
                <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{c.codigo}</td>
                <td className="py-1.5 pr-3" style={{ paddingLeft: (c.nivel - 1) * 14 }}>
                  {c.nome}
                </td>
                <td className="py-1.5 pr-3">{c.nivel}</td>
                <td className="py-1.5 pr-3">{c.grupo}</td>
                <td className="py-1.5 pr-3">
                  <PillNatureza natureza={c.natureza} />
                </td>
                <td className="py-1.5 pr-3">{c.aceitaLancamento ? <Pill tone="green">Sim</Pill> : "—"}</td>
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
            {linhas.length === 0 && (
              <tr>
                <td colSpan={podeEditar ? 7 : 6} className="py-4 text-center text-inkSoft italic">
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
    </div>
  );
}

// ---- Saldos Iniciais (por empresa ativa) ----

function GestaoSaldosView({ empresa, saldos, salvarSaldos, leaves }) {
  const [filtro, setFiltro] = useState("");
  const [rascunho, setRascunho] = useState(saldos || {});

  useEffect(() => {
    setRascunho(saldos || {});
  }, [saldos]);

  if (!empresa) {
    return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima para ver os saldos.</div>;
  }

  const linhas = leaves.filter((c) => {
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
    alert("Saldos iniciais salvos.");
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Saldos Iniciais — {empresa.nome}</h2>
      <p className="text-sm text-inkSoft mb-4">
        Preencha o saldo devedor OU credor de cada conta no início do período (deixe em branco as
        que não tiverem saldo).
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

function GestaoLancamentosView({ empresa, perfil, lancamentos, salvarLancamentos, leaves, contaByCode }) {
  const podeExcluir = !!perfil?.permissoes?.excluirLancamentos;

  const formVazio = () => ({
    data: new Date().toISOString().slice(0, 10),
    tipoOperacao: "",
    historico: "",
    contaDebito: "",
    contaCredito: "",
    valor: "",
    documento: "",
    observacoes: "",
  });

  const [form, setForm] = useState(formVazio());
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  if (!empresa) {
    return (
      <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima para lançar.</div>
    );
  }

  const lanc = lancamentos || [];
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
      documento: l.documento || "",
      observacoes: l.observacoes || "",
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
    if (editandoId === l.id) cancelar();
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (form.contaDebito === form.contaCredito) {
      setErro("A conta de débito e a de crédito não podem ser iguais.");
      return;
    }
    if (!form.contaDebito || !form.contaCredito || !form.valor || !form.historico.trim() || !form.data) {
      setErro("Preencha data, histórico, as duas contas e o valor.");
      return;
    }
    setErro("");
    const dados = { ...form, valor: Number(form.valor), tipoOperacao: form.tipoOperacao || undefined };
    if (editandoId) {
      await salvarLancamentos(lanc.map((l) => (l.id === editandoId ? { ...l, ...dados } : l)));
    } else {
      await salvarLancamentos([...lanc, { id: uid("l"), usuarioId: perfil?.uid, ...dados }]);
    }
    cancelar();
  };

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">
        {editandoId ? "Editar lançamento" : "Novo lançamento"} — {empresa.nome}
      </h2>
      <p className="text-sm text-inkSoft mb-4">
        Toda operação exige uma conta a débito e uma conta a crédito, sempre no mesmo valor
        (partidas dobradas).
      </p>

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

function GestaoBalanceteView({ empresa, lancamentos, saldos, leaves, contaByCode }) {
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
    </div>
  );
}

// ---- DRE ----

function GestaoDREView({ empresa, lancamentos, saldos }) {
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
    </div>
  );
}

// ---- Encerramento (ARE) ----

function GestaoEncerramentoView({ empresa, lancamentos, saldos }) {
  if (!empresa) return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima.</div>;

  const totalReceitas = credMinusDebPrefix(lancamentos, saldos, "4");
  const totalDespesas = debMinusCredPrefix(lancamentos, saldos, "5");
  const totalCustos = debMinusCredPrefix(lancamentos, saldos, "6");
  const resultado = totalReceitas - totalDespesas - totalCustos;
  const lucro = resultado >= 0;

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">
        1) Totais apurados no período por grupo de resultado — {empresa.nome}
      </h2>
      <p className="text-sm text-inkSoft mb-4">
        Esses totais são a base para o encerramento das contas de Receita, Despesa e Custo contra a
        conta 7.1.01 (ARE — Apuração do Resultado do Exercício).
      </p>

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
        <b>Observação didática:</b> por simplicidade, este roteiro trabalha por totais de grupo. No
        lançamento real, cada conta analítica de resultado deve ser encerrada individualmente contra
        a 7.1.01 (ARE) — um lançamento por conta — antes do lançamento final de destinação. Use esses
        valores como referência e pratique o encerramento conta a conta no módulo Lançamentos.
      </div>
    </div>
  );
}

// ---- Balanço Patrimonial ----

function GestaoBalancoView({ empresa, lancamentos, saldos }) {
  if (!empresa) return <div className="text-sm text-inkSoft italic">Selecione uma empresa ativa acima.</div>;

  const ativoCirc = debMinusCredPrefix(lancamentos, saldos, "1.1");
  const ativoNaoCirc = debMinusCredPrefix(lancamentos, saldos, "1.2");
  const totalAtivo = ativoCirc + ativoNaoCirc;
  const passivoCirc = credMinusDebPrefix(lancamentos, saldos, "2.1");
  const passivoNaoCirc = credMinusDebPrefix(lancamentos, saldos, "2.2");
  const pl = credMinusDebPrefix(lancamentos, saldos, "3");
  const resultadoDRE = computeDRE(lancamentos, saldos).resultadoLiquido;
  const totalPassivoPL = passivoCirc + passivoNaoCirc + pl + resultadoDRE;
  const ok = Math.abs(totalAtivo - totalPassivoPL) < 0.005;

  return (
    <div>
      <SeloFechamento ok={ok} rotulo="Balanço" formula="A = P+PL" />
      <h2 className="text-lg font-serif font-semibold text-ink mb-1">Balanço Patrimonial — {empresa.nome}</h2>
      <p className="text-sm text-inkSoft mb-4">
        Consolidado a partir dos saldos iniciais e dos lançamentos do período desta empresa.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-serif font-semibold text-ink mb-2">ATIVO</h3>
          <LinhaBP label="Ativo Circulante" valor={ativoCirc} />
          <LinhaBP label="Ativo Não Circulante" valor={ativoNaoCirc} />
          <LinhaBP label="TOTAL DO ATIVO" valor={totalAtivo} total />
        </Card>
        <Card>
          <h3 className="font-serif font-semibold text-ink mb-2">PASSIVO + PATRIMÔNIO LÍQUIDO</h3>
          <LinhaBP label="Passivo Circulante" valor={passivoCirc} />
          <LinhaBP label="Passivo Não Circulante" valor={passivoNaoCirc} />
          <LinhaBP label="Patrimônio Líquido" valor={pl} />
          <LinhaBP label="Resultado Líquido do Exercício (DRE)" valor={resultadoDRE} />
          <LinhaBP label="TOTAL DO PASSIVO + PL" valor={totalPassivoPL} total />
        </Card>
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

function GestaoUsuariosView({ perfil, usuarios, turmas, recarregar }) {
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
    recarregar();
  };

  const mudarTurma = async (usuario, turmaId) => {
    await atualizarUsuario(usuario.uid, { turmaId: turmaId || null });
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
            await atualizarUsuario(editandoPermissoesUid, { permissoes });
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function GestaoAprovacoesView({ usuarios, turmas, recarregar }) {
  const pendentes = (usuarios || []).filter((u) => !u.aprovado);
  const turmaNome = (id) => (turmas || []).find((t) => t.id === id)?.nome || "—";

  const aprovar = async (u) => {
    await atualizarUsuario(u.uid, { aprovado: true });
    recarregar();
  };

  const rejeitar = async (u) => {
    if (!confirm(`Rejeitar e excluir o cadastro de "${u.nome}"?`)) return;
    await excluirUsuarioDoc(u.uid);
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
  const [aba, setAba] = useState("capa");
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
  const [empresaAtivaId, setEmpresaAtivaId] = useState(null);
  const empresaAtiva = (empresas || []).find((e) => e.id === empresaAtivaId) || null;
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
    <Layout perfil={perfil} aba={aba} setAba={setAba}>
      {aba === "capa" && <Capa perfil={perfil} setAba={setAba} contagens={contagens} />}
      {aba === "turmas" && (
        <GestaoTurmasView
          perfil={perfil}
          turmas={turmas}
          salvarTurmas={salvarTurmas}
          recarregarTurmas={recarregarTurmas}
          usuarios={usuarios}
        />
      )}
      {aba === "empresas" && (
        <GestaoEmpresasView perfil={perfil} empresas={empresas} salvarEmpresas={salvarEmpresas} />
      )}
      {aba === "usuarios" && (
        <GestaoUsuariosView perfil={perfil} usuarios={usuarios} turmas={turmas} recarregar={recarregarUsuarios} />
      )}
      {aba === "aprovacoes" && (
        <GestaoAprovacoesView usuarios={usuarios} turmas={turmas} recarregar={recarregarUsuarios} />
      )}
      {aba === "plano-contas" && (
        <GestaoPlanoContasView
          perfil={perfil}
          contas={contasAtivas}
          salvarPlanoContas={salvarPlanoContas}
          auditoria={auditoria}
          registrarAuditoria={registrarAuditoria}
        />
      )}
      {aba === "saldos" && (
        <>
          <SeletorEmpresaAtiva empresas={empresas} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoSaldosView empresa={empresaAtiva} saldos={saldos} salvarSaldos={salvarSaldos} leaves={leavesAtivas} />
        </>
      )}
      {aba === "lancamentos" && (
        <>
          <SeletorEmpresaAtiva empresas={empresas} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoLancamentosView
            empresa={empresaAtiva}
            perfil={perfil}
            lancamentos={lancamentos}
            salvarLancamentos={salvarLancamentos}
            leaves={leavesAtivas}
            contaByCode={contaByCodeAtivo}
          />
        </>
      )}
      {aba === "razao" && (
        <>
          <SeletorEmpresaAtiva empresas={empresas} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
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
          <SeletorEmpresaAtiva empresas={empresas} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoBalanceteView
            empresa={empresaAtiva}
            lancamentos={lancamentos}
            saldos={saldos}
            leaves={leavesAtivas}
            contaByCode={contaByCodeAtivo}
          />
        </>
      )}
      {aba === "dre" && (
        <>
          <SeletorEmpresaAtiva empresas={empresas} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoDREView empresa={empresaAtiva} lancamentos={lancamentos} saldos={saldos} />
        </>
      )}
      {aba === "encerramento" && (
        <>
          <SeletorEmpresaAtiva empresas={empresas} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoEncerramentoView empresa={empresaAtiva} lancamentos={lancamentos} saldos={saldos} />
        </>
      )}
      {aba === "balanco" && (
        <>
          <SeletorEmpresaAtiva empresas={empresas} empresaAtivaId={empresaAtivaId} setEmpresaAtivaId={setEmpresaAtivaId} />
          <GestaoBalancoView empresa={empresaAtiva} lancamentos={lancamentos} saldos={saldos} />
        </>
      )}
      {moduloFuturo && <ModuloEmBreve modulo={moduloFuturo} />}
    </Layout>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tela, setTela] = useState("login"); // login | cadastro
  const [turmas] = useSharedList("turmas");
  const [perfil, recarregarPerfil] = useUsuario(user?.uid);

  useEffect(() => {
    const unsub = observarSessao((u) => setUser(u || null));
    return () => unsub();
  }, []);

  if (user === undefined) return <LoadingScreen texto="Verificando sessão…" />;

  if (!user) {
    return tela === "cadastro" ? (
      <TelaCadastro turmas={turmas} onIrParaLogin={() => setTela("login")} />
    ) : (
      <TelaLogin onIrParaCadastro={() => setTela("cadastro")} />
    );
  }

  if (perfil === undefined) return <LoadingScreen texto="Carregando seu perfil…" />;

  if (!perfil) return <LoadingScreen texto="Preparando sua conta…" />;

  if (!perfil.aprovado) return <TelaAguardandoAprovacao perfil={perfil} />;

  return <Dashboard user={user} perfil={perfil} recarregarPerfil={recarregarPerfil} />;
}
