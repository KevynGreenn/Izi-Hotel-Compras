// -----------------------------------------------------------------------------
// --- IZI-COMPRAS-BACKEND - SERVER.JS (CORRIGIDO E PRONTO PARA DEPLOY) ---
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
// A Render define a porta através de uma variável de ambiente, por isso usamos `process.env.PORT`
const port = process.env.PORT || 3000;
app.use(express.json());
// Configuração do CORS mais específica para produção
const corsOptions = {
  origin: 'https://kevyngreenn.github.io', // Permite APENAS requisições vindas do seu site
  optionsSuccessStatus: 200 // Para compatibilidade com navegadores mais antigos
};

app.use(cors(corsOptions));

// --- CORREÇÃO 1: Conexão com o Banco de Dados Universal ---
// Este novo código primeiro tenta usar a DATABASE_URL (que a Render fornece).
// Se não a encontrar, ele usa as suas variáveis locais.
// Também adiciona a configuração SSL, que é OBRIGATÓRIA para bases de dados online como a Neon.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- 3. FUNÇÃO AUXILIAR DE ENVIO DE E-MAIL ---
async function enviarEmailAprovacao(emailDestino, token) {
    console.log(`Preparando e-mail para ${emailDestino} com o token ${token}`);

    // --- CORREÇÃO 2: URL do Frontend Dinâmico ---
    // Em vez de um link fixo para localhost, agora usamos o URL do seu site no GitHub Pages.
    // Você DEVE criar uma variável de ambiente na Render chamada FRONTEND_URL com o link do seu site.
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5500'; // Valor padrão para testes locais
    const linkAprovacao = `${frontendUrl}/aprovar.html?token=${token}`;

    const msg = {
        to: emailDestino, // Corrigido para usar o parâmetro da função
        from: 'kevynwpantunes2@gmail.com', // Este deve ser o seu e-mail verificado no SendGrid
        subject: 'Nova Requisição de Compra para Aprovação',
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Nova Requisição de Compra</h2>
                <p>Olá,</p>
                <p>Uma nova solicitação de compra foi registrada e precisa da sua aprovação.</p>
                <p><strong>Clique no botão abaixo para visualizar os detalhes e aprovar:</strong></p>
                <a href="${linkAprovacao}" style="display: inline-block; padding: 12px 20px; margin: 15px 0; font-size: 16px; background-color: #8B0000; color: white; text-decoration: none; border-radius: 5px;">
                    Ver e Aprovar Requisição
                </a>
                <p style="font-size: 12px;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
                <p style="font-size: 12px; color: #555;">${linkAprovacao}</p>
                <hr>
                <p style="font-size: 10px; color: #999;">Este é um e-mail automático do Sistema de Compras Izi Hotel.</p>
            </div>
        `,
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

app.post('/api/requisicao', async (req, res) => {
    try {
        const { nome, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor } = req.body;
        const token = crypto.randomBytes(20).toString('hex');

        const insertQuery = `
            INSERT INTO requisicoes
            (token, nome_solicitante, telefone, descricao, centro_custo, valor, data_pagamento, opcao_pagamento, pix_fornecedor, nome_fornecedor)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;
        const values = [token, nome, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor];

        const result = await pool.query(insertQuery, values);
        console.log(`Requisição salva com sucesso! ID: ${result.rows[0].id}, Token: ${token}`);
        
        // --- CORREÇÃO 3: E-mail do Aprovador Dinâmico ---
        // Agora, o e-mail do aprovador vem de uma variável de ambiente para ser mais seguro e flexível.
        const approverEmail = process.env.APPROVER_EMAIL;
        if (approverEmail) {
            await enviarEmailAprovacao(approverEmail, token);
        } else {
            console.error('AVISO: A variável de ambiente APPROVER_EMAIL não está definida. O e-mail não foi enviado.');
        }

        res.status(201).json({ message: 'Requisição criada com sucesso!' });

    } catch (error) {
        console.error('Erro ao salvar requisição:', error);
        res.status(500).json({ message: 'Ocorreu um erro no servidor ao criar a requisição.' });
    }
});

app.get('/api/requisicao/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const selectQuery = 'SELECT * FROM requisicoes WHERE token = $1';
        const result = await pool.query(selectQuery, [token]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Requisição não encontrada.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar requisição por token:', error);
        res.status(500).json({ message: 'Ocorreu um erro no servidor ao buscar a requisição.' });
    }
});

// --- 5. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
    console.log(`Servidor está rodando na porta ${port}`);
});