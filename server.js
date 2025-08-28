import express from "express";
import path from "path";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// senha de admin (use variável de ambiente em produção)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "212552";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));

// rota de login
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// processa login
app.post("/login", (req, res) => {
  const { senha } = req.body;
  if (senha === ADMIN_PASSWORD) {
    res.cookie("autenticado", "true", { httpOnly: true });
    res.redirect("/aprovar");
  } else {
    res.send("<h1>Senha incorreta!</h1><a href='/login'>Tentar novamente</a>");
  }
});

// middleware para proteger aprovar.html
app.use("/aprovar", (req, res, next) => {
  if (req.cookies.autenticado === "true") return next();
  res.redirect("/login");
});

// rota protegida
app.get("/aprovar", (req, res) => {
  res.sendFile(path.join(__dirname, "aprovar.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
