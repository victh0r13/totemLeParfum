/**
 * Agendamento das rotinas do totem DENTRO do processo do servidor.
 *
 * A primeira versão disto usava o Agendador de Tarefas do Windows chamando
 * .cmd. Três problemas: piscava uma janela de console a cada 5 minutos, só
 * funcionava no Windows, e o agendamento vivia fora do repositório (invisível
 * em code review, impossível de versionar). Aqui o servidor — que já é um
 * processo de longa duração — cuida das próprias rotinas.
 *
 * Garantias:
 *   - nunca duas rodadas ao mesmo tempo (uma trava por rotina);
 *   - falha de uma rodada não derruba o servidor nem cancela as próximas;
 *   - o relógio é de intervalo, não de horário de parede, exceto o sync
 *     completo, que tem hora marcada (madrugada, quando a loja está fechada).
 */

const MINUTO = 60 * 1000;

/** Uma rotina agendada, com trava contra execuções sobrepostas. */
class Rotina {
  constructor(nome, executar) {
    this.nome = nome;
    this.executar = executar;
    this.rodando = false;
    this.ultimaExecucao = null;
    this.ultimoErro = null;
  }

  async rodar(motivo) {
    if (this.rodando) {
      console.log(`[agenda] ${this.nome}: rodada anterior ainda em andamento, pulando.`);
      return null;
    }
    this.rodando = true;
    const inicio = Date.now();
    console.log(`\n[agenda] ${this.nome} — início (${motivo})`);
    try {
      const resultado = await this.executar();
      this.ultimaExecucao = new Date().toISOString();
      this.ultimoErro = null;
      console.log(`[agenda] ${this.nome} — fim em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
      return resultado;
    } catch (err) {
      // Uma falha de rede ou do Bling não pode parar o servidor: registra e
      // deixa a próxima rodada tentar de novo.
      this.ultimoErro = err.message;
      console.error(`[agenda] ${this.nome} — FALHOU: ${err.message}`);
      return null;
    } finally {
      this.rodando = false;
    }
  }
}

/** Milissegundos até a próxima ocorrência de hh:mm no relógio local. */
function ateHorario(hora, minuto) {
  const agora = new Date();
  const alvo = new Date(agora);
  alvo.setHours(hora, minuto, 0, 0);
  if (alvo <= agora) alvo.setDate(alvo.getDate() + 1);
  return alvo.getTime() - agora.getTime();
}

/**
 * Liga as rotinas do totem.
 *
 * @param {object} opcoes
 * @param {() => Promise<unknown>} opcoes.quick        sync de preço e estoque
 * @param {() => Promise<unknown>} opcoes.completo     sync completo + curadoria + fotos
 * @param {number} [opcoes.intervaloQuickMin]          padrão: 5 minutos
 * @param {[number, number]} [opcoes.horarioCompleto]  padrão: 05:00
 * @returns {{ rotinas: Rotina[], parar: () => void, status: () => object }}
 */
export function iniciarAgenda({
  quick,
  completo,
  intervaloQuickMin = 5,
  horarioCompleto = [5, 0],
}) {
  const rotinaQuick = new Rotina('sync rápido', quick);
  const rotinaCompleta = new Rotina('sync completo', completo);
  const timers = [];

  timers.push(setInterval(() => rotinaQuick.rodar('intervalo'), intervaloQuickMin * MINUTO));

  // Hora marcada: espera até o primeiro horário e daí segue de 24 em 24h.
  const agendarCompleto = () => {
    const espera = ateHorario(horarioCompleto[0], horarioCompleto[1]);
    timers.push(
      setTimeout(async () => {
        await rotinaCompleta.rodar('horário diário');
        agendarCompleto();
      }, espera),
    );
    const horas = (espera / 3600000).toFixed(1);
    console.log(`[agenda] sync completo: próxima rodada em ${horas}h`);
  };
  agendarCompleto();

  console.log(`[agenda] sync rápido: a cada ${intervaloQuickMin} min`);

  // Uma rodada rápida logo ao subir, para o servidor não começar com dado velho.
  rotinaQuick.rodar('inicialização');

  return {
    rotinas: [rotinaQuick, rotinaCompleta],
    parar: () => {
      for (const t of timers) {
        clearInterval(t);
        clearTimeout(t);
      }
    },
    status: () =>
      Object.fromEntries(
        [rotinaQuick, rotinaCompleta].map((r) => [
          r.nome,
          { rodando: r.rodando, ultimaExecucao: r.ultimaExecucao, ultimoErro: r.ultimoErro },
        ]),
      ),
  };
}
