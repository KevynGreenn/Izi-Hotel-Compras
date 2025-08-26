// -----------------------------------------------------------------------------
// --- IZI-COMPRAS-BACKEND - SERVER.JS (COMPLETO ATÉ A FASE 4) ---
// -----------------------------------------------------------------------------

// --- 1. IMPORTAÇÃO DAS BIBLIOTECAS ---
const express = require('express');
const crypto = require('crypto');      // Para gerar o token seguro
require('dotenv').config();            // Para carregar as variáveis do arquivo .env
const cors = require('cors');          // Para permitir a comunicação entre frontend e backend
const { Pool } = require('pg');        // Para "conversar" com o banco de dados PostgreSQL
const sgMail = require('@sendgrid/mail');// Para enviar e-mails via SendGrid

// --- 2. CONFIGURAÇÕES PRINCIPAIS ---

// Configuração da aplicação Express
const app = express();
const port = 3000;
app.use(express.json()); // Middleware para entender JSON
app.use(cors());         // Middleware para habilitar o CORS

// Configuração da conexão com o Banco de Dados (usando variáveis do .env)
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

// Configuração do SendGrid (usando a API Key do .env)
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- 3. FUNÇÃO AUXILIAR DE ENVIO DE E-MAIL ---

async function enviarEmailAprovacao(emailDestino, token) {
    console.log(`Preparando e-mail para ${emailDestino} com o token ${token}`);

    // Link para a página de aprovação que criamos
    const linkAprovacao = `http://127.0.0.1:5500/aprovar.html?token=${token}`;

    const msg = {
        to: emailDestino,
        from: 'seu.email.verificado@gmail.com', // << MUDE AQUI para o seu e-mail verificado no SendGrid
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

/**
 * ROTA PARA CRIAR UMA NOVA REQUISIÇÃO
 * Método: POST
 * URL: /api/requisicao
 * Recebe: um JSON com os dados do formulário.
 * Retorna: uma mensagem de sucesso ou erro.
 */
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

        // Chama a função para enviar o e-mail após salvar no banco
        await enviarEmailAprovacao('email.do.aprovador@gmail.com', token); // << MUDE AQUI para o e-mail de quem aprova

        res.status(201).json({ message: 'Requisição criada com sucesso!' });

    } catch (error) {
        console.error('Erro ao salvar requisição:', error);
        res.status(500).json({ message: 'Ocorreu um erro no servidor ao criar a requisição.' });
    }
});


/**
 * ROTA PARA BUSCAR UMA REQUISIÇÃO ESPECÍFICA
 * Método: GET
 * URL: /api/requisicao/:token (onde :token é o token da requisição)
 * Recebe: o token pela URL.
 * Retorna: um JSON com todos os dados da requisição encontrada.
 */
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
    console.log(`Servidor está rodando em http://localhost:${port}`);
});