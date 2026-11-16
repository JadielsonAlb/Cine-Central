import express from "express";
import authRoutes from "./routes/auth";
import pedidosRoutes from "./routes/pedidos";
import poolRoutes from "./routes/pool";
import path from "path";

const app = express();

app.use(express.json());

   app.use(express.static(path.join(__dirname, "..", "public")));
   app.get("/status", (req, res) => {
  res.status(200).json({
    mensagem: "API de Ingressos funcionando!",
    status: "ONLINE"
  });
});



// Rotas de autenticação
app.use("/auth", authRoutes);
app.use("/pedidos", pedidosRoutes);
app.use("/pool", poolRoutes);

const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}/ `);
});