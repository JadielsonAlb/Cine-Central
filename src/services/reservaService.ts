import { database } from "../config/database";

const COTA_POR_USUARIO = 2;

// Erro "esperado" (regra de negócio): vira resposta 404/409, nunca 500.
export class ErroNegocio extends Error {
  constructor(public httpStatus: number, public codigo: string) {
    super(codigo);
  }
}

async function reservarNoBanco(pedidoId: number, usuarioId: number) {
  const client = await database.connect();

  try {
    await client.query("BEGIN");

    // 1) Trava a linha do pedido e já confere se ele é DESTE usuário.
    //    Se não existe ou é de outro dono -> 404 (blindagem de propriedade).
    const pedido = await client.query(
      "SELECT status FROM pedidos WHERE id = $1 AND usuario_id = $2 FOR UPDATE",
      [pedidoId, usuarioId]
    );
    if (pedido.rowCount === 0) {
      throw new ErroNegocio(404, "PEDIDO_NAO_ENCONTRADO");
    }
    if (pedido.rows[0].status !== "NO_CARRINHO") {
      throw new ErroNegocio(409, "STATUS_INVALIDO");
    }

    // 2) Cota pessoal: trava a linha do usuário para que DUAS reservas do mesmo
    //    usuário não passem juntas. Só depois de ter a trava é que conta.
    await client.query("SELECT id FROM usuarios WHERE id = $1 FOR UPDATE", [usuarioId]);
    const cota = await client.query(
      "SELECT COUNT(*)::int AS n FROM pedidos WHERE usuario_id = $1 AND status = 'RESERVADO'",
      [usuarioId]
    );
    if (cota.rows[0].n >= COTA_POR_USUARIO) {
      throw new ErroNegocio(409, "COTA_PESSOAL");
    }

    // 3) Pool global: UM único UPDATE condicional. Checar e incrementar acontecem
    //    juntos, de forma atômica. Se ocupadas já é 100, nenhuma linha é afetada.
    const vaga = await client.query(
      "UPDATE pool SET ocupadas = ocupadas + 1 WHERE id = 1 AND ocupadas < total"
    );
    if (vaga.rowCount === 0) {
      throw new ErroNegocio(409, "POOL_CHEIO");
    }

    // 4) Marca o pedido como reservado e confirma tudo de uma vez.
    await client.query("UPDATE pedidos SET status = 'RESERVADO' WHERE id = $1", [pedidoId]);
    await client.query("COMMIT");

    return { id: pedidoId, status: "RESERVADO" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelar(pedidoId: number, usuarioId: number) {
  const client = await database.connect();

  try {
    await client.query("BEGIN");

    const pedido = await client.query(
      "SELECT status FROM pedidos WHERE id = $1 AND usuario_id = $2 FOR UPDATE",
      [pedidoId, usuarioId]
    );
    if (pedido.rowCount === 0) {
      throw new ErroNegocio(404, "PEDIDO_NAO_ENCONTRADO");
    }
    if (pedido.rows[0].status !== "RESERVADO") {
      throw new ErroNegocio(409, "STATUS_INVALIDO");
    }

    // Devolve a vaga ao pool e muda o status na MESMA transação.
    await client.query("UPDATE pool SET ocupadas = ocupadas - 1 WHERE id = 1");
    await client.query("UPDATE pedidos SET status = 'CANCELADO' WHERE id = $1", [pedidoId]);
    await client.query("COMMIT");

    return { id: pedidoId, status: "CANCELADO" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// Fila FIFO (primeiro a chegar, primeiro a ser atendido).
// Cada chamada é encadeada DEPOIS da anterior, então as reservas são
// processadas exatamente na ordem em que chegaram a esta função.
// A correção (nunca passar de 100 / cota de 2) continua garantida pelo
// banco; a fila só torna a ordem de atendimento explícita.
// ---------------------------------------------------------------
let fila: Promise<unknown> = Promise.resolve();

export function reservar(pedidoId: number, usuarioId: number) {
  const resultado = fila.then(() => reservarNoBanco(pedidoId, usuarioId));
  fila = resultado.catch(() => {}); // um erro não pode travar a fila
  return resultado;
}
