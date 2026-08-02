import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import { Chip } from '@/components/Chip';
import { CtaButton } from '@/components/CtaButton';
import { PinGate } from '@/components/PinGate';
import { PressableScale } from '@/components/PressableScale';
import { TopBar } from '@/components/TopBar';
import { useToast } from '@/components/ToastProvider';
import { API_URL } from '@/config';
import { escolherFoto } from '@/data/fotos';
import { useLocalProducts } from '@/data/localProductsStore';
import { useKiosk } from '@/kiosk/KioskProvider';
import { formatAge, formatPrice } from '@/logic/format';
import {
  produtoParaRascunho,
  RASCUNHO_VAZIO,
  temErro,
  validarRascunho,
  type ErrosProduto,
  type RascunhoProduto,
} from '@/logic/produtosLocais';
import { colors, familyLabels, fonts } from '@/theme/theme';
import type { Familia, Genero, Intensidade, Ocasiao, ProdutoLocal } from '@/types/catalog';

const GENEROS: [Genero, string][] = [
  ['F', 'Feminino'],
  ['M', 'Masculino'],
  ['U', 'Unissex'],
];

const OCASIOES: [Ocasiao, string][] = [
  ['trabalho', 'Trabalho'],
  ['dia', 'Dia a dia'],
  ['noite', 'Noite & eventos'],
  ['esporte', 'Esporte'],
];

const INTENSIDADES: [Intensidade, string][] = [
  [1, 'Leve'],
  [2, 'Moderada'],
  [3, 'Marcante'],
];

const FAMILIAS = Object.entries(familyLabels) as [Familia, string][];

/** Alterna um item numa lista de seleção múltipla (famílias, ocasiões). */
function alternar<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];
}

function Campo({
  label,
  valor,
  onChange,
  erro,
  placeholder,
  teclado = 'default',
  multiline = false,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  placeholder?: string;
  teclado?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, !!erro && styles.inputErro]}
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={teclado}
        multiline={multiline}
       />
      {!!erro && <Text style={styles.erro}>{erro}</Text>}
    </View>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{titulo}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

/**
 * Cadastro de produtos da própria loja — o CRUD que não depende do Bling.
 *
 * Protegido por PIN pelo mesmo motivo do painel: envolver o conteúdo, e não o
 * caminho até ele, para um deep link `leparfum://produtos` não entrar direto.
 */
export default function ProdutosScreen() {
  return (
    <PinGate title="Produtos da loja">
      <ProdutosPanel />
    </PinGate>
  );
}

function ProdutosPanel() {
  const router = useRouter();
  const { showToast } = useToast();
  const { suspender } = useKiosk();
  const { produtos, pendencias, sincronizando, ultimoEnvio, salvar, remover, sincronizarAgora } =
    useLocalProducts();

  const [editando, setEditando] = useState<ProdutoLocal | null>(null);
  const [criando, setCriando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoProduto>(RASCUNHO_VAZIO);
  const [erros, setErros] = useState<ErrosProduto>({});
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<string | null>(null);
  const [escolhendoFoto, setEscolhendoFoto] = useState(false);

  const formAberto = criando || editando !== null;

  // Enquanto o formulário está aberto, o relógio do quiosque fica parado: quem
  // digita não gera toque na tela e seria expulso no meio do cadastro.
  useEffect(() => {
    suspender(formAberto);
    return () => suspender(false);
  }, [formAberto, suspender]);

  const abrirNovo = useCallback(() => {
    setRascunho(RASCUNHO_VAZIO);
    setErros({});
    setEditando(null);
    setCriando(true);
  }, []);

  const abrirEdicao = useCallback((produto: ProdutoLocal) => {
    setRascunho(produtoParaRascunho(produto));
    setErros({});
    setCriando(false);
    setEditando(produto);
  }, []);

  const fechar = useCallback(() => {
    setCriando(false);
    setEditando(null);
    setErros({});
  }, []);

  const confirmar = useCallback(async () => {
    const encontrados = validarRascunho(rascunho);
    setErros(encontrados);
    if (temErro(encontrados)) return;
    const produto = await salvar(rascunho, editando ?? undefined);
    fechar();
    showToast(
      editando ? `${produto.nome} atualizado.` : `${produto.nome} cadastrado no catálogo.`,
    );
  }, [editando, fechar, rascunho, salvar, showToast]);

  const confirmarRemocao = useCallback(
    async (produto: ProdutoLocal) => {
      await remover(produto.id);
      setConfirmandoRemocao(null);
      showToast(`${produto.nome} removido.`);
    },
    [remover, showToast],
  );

  const set = useCallback(
    <K extends keyof RascunhoProduto>(campo: K, valor: RascunhoProduto[K]) =>
      setRascunho((prev) => ({ ...prev, [campo]: valor })),
    [],
  );

  const trocarFoto = useCallback(async () => {
    setEscolhendoFoto(true);
    try {
      // O id só existe depois de salvar; num produto novo usamos um provisório
      // apenas para nomear o arquivo — o conteúdo é o que importa.
      const uri = await escolherFoto(editando?.id ?? 'novo');
      if (uri) set('fotoLocal', uri);
    } catch {
      showToast('Não foi possível carregar a foto.');
    } finally {
      setEscolhendoFoto(false);
    }
  }, [editando, set, showToast]);

  const foraDaVitrine = useMemo(
    () => produtos.filter((p) => p.estoque <= 0).length,
    [produtos],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar title="Produtos da loja" onBack={() => router.replace('/admin')} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Produtos da loja</Text>
          <Text style={styles.subtitle}>
            Cadastrados aqui no totem, sem passar pelo Bling. Aparecem no catálogo junto dos
            demais.
          </Text>

          {/* O selo de pendências é o que torna visível que a escrita é
              offline-first: sem ele, "salvou" e "subiu para o PC" pareceriam a
              mesma coisa. */}
          <View style={[styles.sinc, pendencias.length > 0 && styles.sincPendente]}>
            <View style={[styles.sincDot, pendencias.length > 0 && styles.sincDotPendente]} />
            <Text style={styles.sincTexto}>
              {!API_URL
                ? 'Servidor não configurado — os produtos ficam só neste tablet.'
                : pendencias.length > 0
                  ? `${pendencias.length} alteração${pendencias.length === 1 ? '' : 'ões'} aguardando o servidor da loja.`
                  : ultimoEnvio
                    ? `Tudo sincronizado com o servidor · ${formatAge(ultimoEnvio)}`
                    : 'Tudo sincronizado com o servidor da loja.'}
            </Text>
            {!!API_URL && pendencias.length > 0 && (
              <PressableScale
                scaleTo={0.94}
                onPress={() => {
                  sincronizarAgora();
                }}
                style={styles.sincBotao}
              >
                <Text style={styles.sincBotaoTexto}>
                  {sincronizando ? 'Enviando...' : 'Tentar agora'}
                </Text>
              </PressableScale>
            )}
          </View>

          {!formAberto && (
            <CtaButton label="Cadastrar produto" onPress={abrirNovo} style={styles.novoBotao} />
          )}

          {formAberto && (
            <View style={styles.form}>
              <Text style={styles.formTitulo}>
                {editando ? 'Editar produto' : 'Novo produto'}
              </Text>

              <Campo
                label="Nome *"
                valor={rascunho.nome}
                onChange={(v) => set('nome', v)}
                erro={erros.nome}
                placeholder="Ex.: Âmbar Noturno"
              />
              <Campo
                label="Marca"
                valor={rascunho.marca}
                onChange={(v) => set('marca', v)}
                placeholder="Ex.: Le Parfum"
              />
              <View style={styles.linha}>
                <View style={styles.flex}>
                  <Campo
                    label="Preço *"
                    valor={rascunho.preco}
                    onChange={(v) => set('preco', v)}
                    erro={erros.preco}
                    placeholder="199,90"
                    teclado="decimal-pad"
                  />
                </View>
                <View style={styles.flex}>
                  <Campo
                    label="Estoque *"
                    valor={rascunho.estoque}
                    onChange={(v) => set('estoque', v)}
                    erro={erros.estoque}
                    placeholder="10"
                    teclado="number-pad"
                  />
                </View>
              </View>
              <Campo
                label="Descrição"
                valor={rascunho.descricao}
                onChange={(v) => set('descricao', v)}
                placeholder="Notas, história do produto..."
                multiline
              />

              <View style={styles.campo}>
                <Text style={styles.campoLabel}>Foto</Text>
                <View style={styles.fotoLinha}>
                  <View style={styles.fotoMoldura}>
                    {rascunho.fotoLocal ? (
                      <Image
                        source={{ uri: rascunho.fotoLocal }}
                        style={styles.fotoPreview}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={styles.fotoVazia}>sem{'\n'}foto</Text>
                    )}
                  </View>
                  <View style={styles.fotoBotoes}>
                    <PressableScale
                      scaleTo={0.96}
                      onPress={trocarFoto}
                      disabled={escolhendoFoto}
                      style={styles.acao}
                    >
                      <Text style={styles.acaoTexto}>
                        {escolhendoFoto
                          ? 'Abrindo...'
                          : rascunho.fotoLocal
                            ? 'Trocar foto'
                            : 'Escolher foto'}
                      </Text>
                    </PressableScale>
                    {!!rascunho.fotoLocal && (
                      <PressableScale
                        scaleTo={0.96}
                        onPress={() => set('fotoLocal', null)}
                        style={styles.acao}
                      >
                        <Text style={styles.acaoTexto}>Remover foto</Text>
                      </PressableScale>
                    )}
                  </View>
                </View>
                <Text style={styles.fotoDica}>
                  Opcional. Sem foto, o produto aparece com o degradê da família olfativa. A
                  imagem é reduzida para 800px antes de ser guardada.
                </Text>
              </View>

              <Grupo titulo="Gênero">
                {GENEROS.map(([valor, label]) => (
                  <Chip
                    key={valor}
                    label={label}
                    size="sm"
                    selected={rascunho.genero === valor}
                    onPress={() => set('genero', rascunho.genero === valor ? null : valor)}
                  />
                ))}
              </Grupo>

              <Grupo titulo="Famílias olfativas">
                {FAMILIAS.map(([valor, label]) => (
                  <Chip
                    key={valor}
                    label={label}
                    size="sm"
                    selected={rascunho.familias.includes(valor)}
                    onPress={() => set('familias', alternar(rascunho.familias, valor))}
                  />
                ))}
              </Grupo>

              <Grupo titulo="Ocasiões">
                {OCASIOES.map(([valor, label]) => (
                  <Chip
                    key={valor}
                    label={label}
                    size="sm"
                    selected={rascunho.ocasioes.includes(valor)}
                    onPress={() => set('ocasioes', alternar(rascunho.ocasioes, valor))}
                  />
                ))}
              </Grupo>

              <Grupo titulo="Intensidade">
                {INTENSIDADES.map(([valor, label]) => (
                  <Chip
                    key={valor}
                    label={label}
                    size="sm"
                    selected={rascunho.intensidade === valor}
                    onPress={() =>
                      set('intensidade', rascunho.intensidade === valor ? null : valor)
                    }
                  />
                ))}
              </Grupo>

              <Text style={styles.dica}>
                Gênero, famílias e ocasiões alimentam os filtros e o quiz. Deixar em branco não
                impede o cadastro, mas o produto não será sugerido no quiz.
              </Text>

              <View style={styles.formBotoes}>
                <CtaButton
                  label={editando ? 'Salvar alterações' : 'Cadastrar'}
                  onPress={confirmar}
                  style={styles.formBotao}
                />
                <CtaButton
                  label="Cancelar"
                  variant="secondary"
                  onPress={fechar}
                  style={styles.formBotao}
                />
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            {`CADASTRADOS (${produtos.length})`}
          </Text>

          {produtos.length === 0 ? (
            <Text style={styles.empty}>
              Nenhum produto cadastrado neste totem ainda. Use o botão acima para criar o
              primeiro.
            </Text>
          ) : (
            produtos.map((produto) => {
              const pendente = pendencias.some((p) => p.produtoId === produto.id);
              return (
                <View key={produto.id} style={styles.card}>
                  <View style={styles.cardFoto}>
                    {produto.fotoLocal ? (
                      <Image
                        source={{ uri: produto.fotoLocal }}
                        style={styles.fotoPreview}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={styles.fotoVazia}>sem{'\n'}foto</Text>
                    )}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardNome} numberOfLines={1}>
                      {produto.nome}
                    </Text>
                    <Text style={styles.cardLinha}>
                      {produto.marca ? `${produto.marca} · ` : ''}
                      {formatPrice(produto.preco)} · {produto.estoque} em estoque
                    </Text>
                    <View style={styles.cardTags}>
                      {pendente && (
                        <Text style={[styles.tag, styles.tagPendente]}>aguardando envio</Text>
                      )}
                      {produto.estoque <= 0 && (
                        <Text style={[styles.tag, styles.tagOculto]}>fora da vitrine</Text>
                      )}
                    </View>
                  </View>
                  {confirmandoRemocao === produto.id ? (
                    <View style={styles.cardAcoes}>
                      <PressableScale
                        scaleTo={0.94}
                        onPress={() => confirmarRemocao(produto)}
                        style={[styles.acao, styles.acaoPerigo]}
                      >
                        <Text style={styles.acaoPerigoTexto}>Confirmar</Text>
                      </PressableScale>
                      <PressableScale
                        scaleTo={0.94}
                        onPress={() => setConfirmandoRemocao(null)}
                        style={styles.acao}
                      >
                        <Text style={styles.acaoTexto}>Cancelar</Text>
                      </PressableScale>
                    </View>
                  ) : (
                    <View style={styles.cardAcoes}>
                      <PressableScale
                        scaleTo={0.94}
                        onPress={() => abrirEdicao(produto)}
                        style={styles.acao}
                      >
                        <Text style={styles.acaoTexto}>Editar</Text>
                      </PressableScale>
                      <PressableScale
                        scaleTo={0.94}
                        onPress={() => setConfirmandoRemocao(produto.id)}
                        style={styles.acao}
                      >
                        <Text style={styles.acaoTexto}>Excluir</Text>
                      </PressableScale>
                    </View>
                  )}
                </View>
              );
            })
          )}

          {foraDaVitrine > 0 && (
            <Text style={styles.rodape}>
              {foraDaVitrine} produto{foraDaVitrine === 1 ? '' : 's'} com estoque zerado não
              aparece{foraDaVitrine === 1 ? '' : 'm'} no catálogo — a mesma regra vale para os
              produtos do Bling.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 44, paddingBottom: 64 },
  title: { fontFamily: fonts.serif, fontSize: 44, color: colors.ink, marginTop: 28 },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.muted,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 2.6,
    color: colors.gold,
    marginTop: 36,
    marginBottom: 12,
  },
  empty: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.muted },
  sinc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 22,
  },
  sincPendente: { borderColor: colors.goldSoft, backgroundColor: colors.creamGold },
  sincDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.stockOk },
  sincDotPendente: { backgroundColor: colors.stockLow },
  sincTexto: { flex: 1, fontFamily: fonts.sans, fontSize: 14.5, color: colors.inkSoft },
  sincBotao: {
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.2)',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  sincBotaoTexto: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  novoBotao: { marginTop: 20, alignSelf: 'flex-start', paddingHorizontal: 40 },
  form: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    padding: 24,
  },
  formTitulo: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 26,
    color: colors.ink,
    marginBottom: 18,
  },
  campo: { marginBottom: 18 },
  campoLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.inkSoft,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  inputErro: { borderColor: '#a4433a' },
  erro: { fontFamily: fonts.sans, fontSize: 13, color: '#a4433a', marginTop: 6 },
  linha: { flexDirection: 'row', gap: 16 },
  fotoLinha: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  fotoMoldura: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fotoPreview: { width: '100%', height: '100%' },
  fotoVazia: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    textAlign: 'center',
  },
  fotoBotoes: { gap: 8 },
  fotoDica: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dica: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    marginBottom: 20,
  },
  formBotoes: { gap: 12 },
  formBotao: { width: '100%' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  cardFoto: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardInfo: { flex: 1 },
  cardNome: { fontFamily: fonts.serifSemiBold, fontSize: 21, color: colors.ink },
  cardLinha: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 3 },
  cardTags: { flexDirection: 'row', gap: 8, marginTop: 6 },
  tag: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  tagPendente: { backgroundColor: colors.creamGold, color: colors.gold },
  tagOculto: { backgroundColor: 'rgba(33,29,24,0.06)', color: colors.muted },
  cardAcoes: { gap: 8 },
  acao: {
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.2)',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  acaoTexto: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  acaoPerigo: { borderColor: '#a4433a', backgroundColor: '#a4433a' },
  acaoPerigoTexto: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.cream },
  rodape: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 18,
  },
});
