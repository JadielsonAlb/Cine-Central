import { Router } from "express";
import { database } from "../config/database";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", async (_req, res) => {
  try {
    const resultado = await database.query(
      "SELECT total, ocupadas, (total - ocupadas) AS livres FROM pool WHERE id = 1"
    );
    return res.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "ERRO_INTERNO" });
  }
});

export default router;