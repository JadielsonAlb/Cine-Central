import { Router } from "express";
import { database } from "../config/database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

// Cadastro de usuários
router.post("/registrar", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "DADOS_OBRIGATORIOS"
      });
    }

    const existente = await database.query(
      "SELECT id FROM usuarios WHERE username = $1",
      [username]
    );

    if (existente.rows.length > 0) {
      return res.status(409).json({
        error: "USUARIO_EXISTENTE"
      });
    }

    const senhaHash = await bcrypt.hash(password, 10);

    await database.query(
      "INSERT INTO usuarios (username, password_hash) VALUES ($1, $2)",
      [username, senhaHash]
    );

    return res.status(201).json({
      mensagem: "USUARIO_CADASTRADO"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "ERRO_INTERNO"
    });
  }
});
// Login de usuários
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "DADOS_OBRIGATORIOS"
      });
    }

    const resultado = await database.query(
      "SELECT id, username, password_hash FROM usuarios WHERE username = $1",
      [username]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        error: "CREDENCIAIS_INVALIDAS"
      });
    }

    const usuario = resultado.rows[0];

    const senhaValida = await bcrypt.compare(
      password,
      usuario.password_hash
    );

    if (!senhaValida) {
      return res.status(401).json({
        error: "CREDENCIAIS_INVALIDAS"
      });
    }

    const token = jwt.sign(
      { id: usuario.id, username: usuario.username },
      process.env.JWT_SECRET as string,
      { expiresIn: "2h" }
    );

    return res.status(200).json({ token });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "ERRO_INTERNO"
    });
  }
});
export default router;