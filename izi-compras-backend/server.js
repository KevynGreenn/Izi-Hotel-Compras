const express = require('express');
const pkg = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
});

// CORREÇÃO: Define a origem do CORS de forma fixa e correta.
const corsOptions = {
    origin: "https://kevyngreenn.github.io", // A origem NUNCA inclui o caminho
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// FUNÇÃO DE ENVIO DE E-MAIL
async function enviarEmailAprovacao(emailDestino, token) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    // Usa a variável FRONTEND_URL que acabámos de corrigir na Render
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        console.error("ERRO CRÍTICO: FRONTEND_URL não está definido nas variáveis de ambiente. E-mail não será enviado.");
        return;
    }
    const linkAprovacao = `${frontendUrl}/aprovar.html?token=${token}`;

    const msg = {
        to: emailDestino,
        from: 'kevynwpantunes2@gmail.com', // SEU E-MAIL VERIFICADO
        subject: 'Nova Requisição de Compra para Aprovação',
        html: `<p>Uma nova solicitação de compra (#${token.substring(0,6)}) precisa da sua aprovação. Clique no link para visualizar: <a href="${linkAprovacao}">Ver Requisição</a></p>`,
    };

    try {
        await sgMail.send(msg);
        console.log('E-mail de aprovação enviado com o link correto!');
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.response ? error.response.body.errors : error);
    }
}

// RESTANTE DO CÓDIGO (ROTAS) PERMANECE IGUAL...
// Criar requisição
app.post('/api/requisicao', async (req, res) => {
  try {
    const { nome, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    const query = `
      INSERT INTO requisicoes (nome_solicitante, telefone, descricao, centro_custo, valor, data_pagamento, opcao_pagamento, pix_fornecedor, nome_fornecedor, status, token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pendente', $10) RETURNING *`;
    const result = await pool.query(query, [nome, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor, token]);

    const approverEmail = process.env.APPROVER_EMAIL;
    if (approverEmail) {
        await enviarEmailAprovacao(approverEmail, token);
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar requisição:', error);
    res.status(500).json({ message: 'Erro no servidor ao criar requisição.' });
  }
});

// Buscar requisição pelo token
app.get('/api/requisicao/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query('SELECT * FROM requisicoes WHERE token = $1', [token]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar requisição:', error);
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

// Aprovar requisição
app.post('/api/requisicao/:token/aprovar', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query("UPDATE requisicoes SET status = 'Aprovada' WHERE token = $1 RETURNING *", [token]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada.' });
    }
    res.status(200).json({ message: 'Requisição aprovada com sucesso!' });
  } catch (error) {
    console.error('Erro ao aprovar:', error);
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

// Rejeitar requisição
app.post('/api/requisicao/:token/rejeitar', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query("UPDATE requisicoes SET status = 'Rejeitada' WHERE token = $1 RETURNING *", [token]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada.' });
    }
    res.status(200).json({ message: 'Requisição rejeitada.' });
  } catch (error) {
    console.error('Erro ao rejeitar:', error);
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});