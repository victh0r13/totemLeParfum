import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { nomeArquivoFoto } from '@/logic/produtosLocais';

/**
 * Fotos dos produtos cadastrados no totem.
 *
 * A regra é a mesma do resto do offline-first: **a foto vira arquivo nosso, no
 * aparelho, antes de qualquer rede.** O que a galeria devolve é um URI
 * temporário do sistema — apoiar-se nele daria uma foto que some sozinha depois
 * de um tempo, que é exatamente o erro das URLs assinadas do Bling em outra
 * roupagem.
 */

/**
 * Pasta das fotos dentro do sandbox do app.
 *
 * Resolvida sob demanda, e não no topo do módulo: `Paths.document` não existe
 * fora de iOS/Android, e avaliá-lo na importação derrubava a renderização do
 * app inteiro na web — inclusive telas que não têm nada a ver com foto.
 */
function pasta() {
  return new Directory(Paths.document, 'produtos');
}

/**
 * Mesmo tamanho e qualidade que o sync usa nas fotos do Bling
 * ([sync/src/images.js](../../sync/src/images.js)): o totem desenha no máximo
 * uns 400pt de largura, então 800px cobre telas 2x e um JPEG a 82 fica
 * indistinguível do original com uma fração do peso.
 */
const LARGURA_MAX = 800;
const QUALIDADE = 0.82;

function garantirPasta() {
  const destino = pasta();
  if (!destino.exists) destino.create({ intermediates: true });
  return destino;
}

/**
 * Abre a galeria, redimensiona o que a pessoa escolher e guarda no aparelho.
 * Devolve o `file://` da cópia, ou null se ela desistiu.
 *
 * Não pede permissão: no Android 13+ o seletor de fotos do sistema roda fora do
 * app e devolve só o que foi escolhido, sem dar acesso à galeria inteira.
 */
export async function escolherFoto(produtoId: string): Promise<string | null> {
  const escolha = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (escolha.canceled || !escolha.assets?.length) return null;

  const escolhida = escolha.assets[0];
  const contexto = ImageManipulator.manipulate(escolhida.uri);
  // Só encolher, nunca esticar. Redimensionar sem essa condição ampliava uma
  // foto pequena para 800px — mais bytes para trafegar e guardar, sem um pixel
  // de detalhe a mais. `width` pode vir 0 quando o sistema não informa; aí
  // reduzir é o palpite certo, porque o caso comum é foto de câmera.
  if (escolhida.width === 0 || escolhida.width > LARGURA_MAX) {
    // Só a largura: a altura sai por regra de três e a proporção se mantém.
    contexto.resize({ width: LARGURA_MAX });
  }
  const renderizada = await contexto.renderAsync();
  const reduzida = await renderizada.saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALIDADE,
  });

  // O carimbo de tempo no nome faz cada troca de foto gerar um caminho novo.
  // Sem isso, o cache do expo-image — indexado por URI — continuaria exibindo a
  // foto antiga mesmo depois de substituída.
  const destino = new File(garantirPasta(), `${Date.now()}-${nomeArquivoFoto(produtoId)}`);
  new File(reduzida.uri).move(destino);
  return destino.uri;
}

/** Lê a foto para envio. Null quando o arquivo sumiu (usuário limpou dados). */
export async function fotoEmBase64(uri: string): Promise<string | null> {
  try {
    const arquivo = new File(uri);
    return arquivo.exists ? await arquivo.base64() : null;
  } catch {
    return null;
  }
}

/** Melhor-esforço: falhar em apagar uma foto não pode quebrar o cadastro. */
export function apagarFoto(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const arquivo = new File(uri);
    if (arquivo.exists) arquivo.delete();
  } catch {
    // Arquivo já removido ou caminho inválido: nada a fazer.
  }
}
