import { Router, Response } from "express";
import { database } from "../config/database";
import { authMiddleware } from "../middlewares/authMiddleware";
import { reservar, cancelar, ErroNegocio } from "../services/reservaService";

const router = Router();

// Todas as rotas deste arquivo exigem autenticação
router.use(authMiddleware);

// Converte o :id da URL em número; devolve null se for lixo ("abc", "1e9", etc.)
function lerId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

function responderErro(res: Response, error: unknown) {
  if (error instanceof ErroNegocio) {
    return res.status(error.httpStatus).json({ error: error.codigo });
  }
  console.error(error);
  return res.status(500).json({ error: "ERRO_INTERNO" });
}

// Lista os pedidos do usuário logado (a interface usa para montar "Seus ingressos")
router.get("/", async (_req, res) => {
  try {
    const resultado = await database.query(
      'SELECT id, show_id AS "showId", status FROM pedidos WHERE usuario_id = $1 ORDER BY id',
      [res.locals.usuarioId]
    );
    return res.status(200).json(resultado.rows);
  } catch (error) {
    return responderErro(res, error);
  }
});

// Criar um pedido (coloca no carrinho)
router.post("/", async (req, res) => {
  try {
    const { showId } = req.body;
    const usuarioId = res.locals.usuarioId;

    if (!Number.isInteger(showId)) {
      return res.status(400).json({ error: "SHOW_ID_OBRIGATORIO" });
    }

    const resultado = await database.query(
      `INSERT INTO pedidos (usuario_id, show_id, status)
       VALUES ($1, $2, 'NO_CARRINHO')
       RETURNING id, status`,
      [usuarioId, showId]
    );

    return res.status(201).json(resultado.rows[0]);
  } catch (error) {
    return responderErro(res, error);
  }
});

// NO_CARRINHO -> RESERVADO (aqui acontece a disputa)
router.post("/:id/reservar", async (req, res) => {
  try {
    const id = lerId(req.params.id);
    if (id === null) return res.status(404).json({ error: "PEDIDO_NAO_ENCONTRADO" });

    const resultado = await reservar(id, res.locals.usuarioId);

    res.set("X-Lote", "7F3A"); // rastreabilidade: só nas respostas 200 de reservar
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error);
  }
});

// RESERVADO -> CANCELADO
router.post("/:id/cancelar", async (req, res) => {
  try {
    const id = lerId(req.params.id);
    if (id === null) return res.status(404).json({ error: "PEDIDO_NAO_ENCONTRADO" });

    const resultado = await cancelar(id, res.locals.usuarioId);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error);
  }
});

export default router;
