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

const corsOptions = {
    origin: process.env.FRONTEND_URL || "https://kevyngreenn.github.io",
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- FUNÇÕES DE E-MAIL (sem alterações) ---
async function enviarEmailConfirmacaoAdmin(requisicao) { /* ...código existente... */ }


// --- ROTAS DA API ---

// Criar requisição
app.post('/api/requisicao', async (req, res) => {
  try {
    const { nome, email, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    const query = `
      INSERT INTO requisicoes (nome_solicitante, email_solicitante, telefone, descricao, centro_custo, valor, data_pagamento, opcao_pagamento, pix_fornecedor, nome_fornecedor, status, token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pendente', $11) RETURNING token`;
    const result = await pool.query(query, [nome, email, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor, token]);

    // ### LINHA DE DIAGNÓSTICO ADICIONADA AQUI ###
    console.log("DEBUG: Valor da variável FRONTEND_URL:", process.env.FRONTEND_URL);

    res.status(201).json({ 
        token: result.rows[0].token,
        frontend_url: process.env.FRONTEND_URL 
    });
  } catch (error) {
    console.error('Erro ao criar requisição:', error);
    res.status(500).json({ message: 'Erro no servidor ao criar requisição.' });
  }
});

// Outras rotas (GET, aprovar, rejeitar) continuam iguais...
app.get('/api/requisicao/:token', async (req, res) => { /* ...código existente... */ });
app.post('/api/requisicao/:token/aprovar', async (req, res) => { /* ...código existente... */ });
app.post('/api/requisicao/:token/rejeitar', async (req, res) => { /* ...código existente... */ });


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});