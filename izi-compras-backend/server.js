// -----------------------------------------------------------------------------
// --- IZI-COMPRAS-BACKEND - SERVER.JS (VERSÃO CORRIGIDA E FINAL) ---
// -----------------------------------------------------------------------------

// --- 1. IMPORTAÇÃO DAS BIBLIOTECAS ---
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg');
const sgMail = require('@sendgrid/mail');

// --- 2. CONFIGURAÇÕES PRINCIPAIS ---
const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS para permitir requisições APENAS do seu site
const corsOptions = {
  origin: 'https://kevyngreenn.github.io',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Configuração da conexão com o Banco de Dados (funciona localmente e na Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configuração do SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- 3. FUNÇÃO AUXILIAR DE ENVIO DE E-MAIL ---
async function enviarEmailAprovacao(emailDestino, token) {
    console.log(`Preparando e-mail para ${emailDestino} com o token ${token}`);

    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5500'; // Usa o URL do seu site, definido na Render
    const linkAprovacao = `${frontendUrl}/aprovar.html?token=${token}`;

    const msg = {
        to: emailDestino,
        from: 'kevynwpantunes2@gmail.com', // SEU E-MAIL VERIFICADO NO SENDGRID
        subject: 'Nova Requisição de Compra para Aprovação',
        html: `<p>Uma nova solicitação de compra precisa da sua aprovação. Clique no link para visualizar: <a href="${linkAprovacao}">Aprovar Requisição</a></p>`,
    };

    try {
        await sgMail.send(msg);
        console.log('E-mail de aprovação enviado com sucesso!');
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        if (error.response) {
            console.error(error.response.body);
        }
    }
}

// --- 4. ROTAS DA API ---

// ROTA PARA CRIAR UMA NOVA REQUISIÇÃO
app.post('/api/requisicao', async (req, res) => {
    try {
        const { nome, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor } = req.body;
        const token = crypto.randomBytes(20).toString('hex');

        const insertQuery = `
            INSERT INTO requisicoes
            (token, nome_solicitante, telefone, descricao, centro_custo, valor, data_pagamento, opcao_pagamento, pix_fornecedor, nome_fornecedor, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pendente')
            RETURNING id;
        `;
        const values = [token, nome, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor];

        const result = await pool.query(insertQuery, values);
        console.log(`Requisição salva com sucesso! ID: ${result.rows[0].id}`);

        const approverEmail = process.env.APPROVER_EMAIL;
        if (approverEmail) {
            await enviarEmailAprovacao(approverEmail, token);
        } else {
            console.warn('AVISO: APPROVER_EMAIL não definido. E-mail de notificação não enviado.');
        }

        res.status(201).json({ message: 'Requisição criada com sucesso!' });

    } catch (error) {
        console.error('Erro ao salvar requisição:', error);
        res.status(500).json({ message: 'Erro no servidor ao criar a requisição.' });
    }
});

// ROTA PARA BUSCAR UMA REQUISIÇÃO ESPECÍFICA
app.get('/api/requisicao/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await pool.query('SELECT * FROM requisicoes WHERE token = $1', [token]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Requisição não encontrada.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar requisição por token:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});

// ROTA PARA APROVAR UMA REQUISIÇÃO
app.post('/api/requisicao/:token/aprovar', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await pool.query("UPDATE requisicoes SET status = 'Aprovada' WHERE token = $1 RETURNING *", [token]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Requisição não encontrada.' });
        }
        res.status(200).json({ message: 'Requisição aprovada com sucesso!' });
    } catch (error) {
        console.error('Erro ao aprovar requisição:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});

// ROTA PARA REJEITAR UMA REQUISIÇÃO
app.post('/api/requisicao/:token/rejeitar', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await pool.query("UPDATE requisicoes SET status = 'Rejeitada' WHERE token = $1 RETURNING *", [token]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Requisição não encontrada.' });
        }
        res.status(200).json({ message: 'Requisição rejeitada.' });
    } catch (error) {
        console.error('Erro ao rejeitar requisição:', error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});

// --- 5. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});