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
    origin: process.env.FRONTEND_URL,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- FUNÇÕES DE E-MAIL ---

// Envia e-mail para o APROVADOR
async function enviarEmailAprovacao(emailDestino, token) { /* ...código existente sem alterações... */ }

// ### NOVA FUNÇÃO AQUI ###
// Envia e-mail de status para o REQUISITANTE
async function enviarEmailStatus(requisicao) {
    if (!requisicao.email_solicitante) {
        console.log(`Requisição ${requisicao.id} sem e-mail do solicitante. Notificação de status não enviada.`);
        return;
    }
    const statusText = requisicao.status === 'Aprovada' ? 'APROVADA' : 'REJEITADA';
    const msg = {
        to: requisicao.email_solicitante,
        from: 'kevynwpantunes2@gmail.com', // SEU E-MAIL VERIFICADO
        subject: `Sua Requisição de Compra foi ${statusText}`,
        html: `
            <p>Olá, ${requisicao.nome_solicitante},</p>
            <p>A sua requisição de compra para "${requisicao.descricao.substring(0, 50)}..." foi <strong>${statusText}</strong>.</p>
            <p>ID da Requisição: #${requisicao.token.substring(0,6)}</p>
        `,
    };
    try {
        await sgMail.send(msg);
        console.log(`E-mail de status '${statusText}' enviado para ${requisicao.email_solicitante}`);
    } catch (error) {
        console.error('Erro ao enviar e-mail de status:', error.response ? error.response.body : error);
    }
}

// --- ROTAS DA API ---

// Criar requisição
app.post('/api/requisicao', async (req, res) => {
  try {
    const { nome, email, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    const query = `
      INSERT INTO requisicoes (nome_solicitante, email_solicitante, telefone, descricao, centro_custo, valor, data_pagamento, opcao_pagamento, pix_fornecedor, nome_fornecedor, status, token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pendente', $11) RETURNING *`;
    // Adicionado "email" no insert
    const result = await pool.query(query, [nome, email, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor, token]);

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

// Buscar requisição (sem alterações)
app.get('/api/requisicao/:token', async (req, res) => { /* ...código existente... */ });

// Aprovar requisição
app.post('/api/requisicao/:token/aprovar', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query("UPDATE requisicoes SET status = 'Aprovada' WHERE token = $1 RETURNING *", [token]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada.' });
    }
    // ### CHAMADA DA NOVA FUNÇÃO AQUI ###
    await enviarEmailStatus(result.rows[0]);
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
    // ### CHAMADA DA NOVA FUNÇÃO AQUI ###
    await enviarEmailStatus(result.rows[0]);
    res.status(200).json({ message: 'Requisição rejeitada.' });
  } catch (error) {
    console.error('Erro ao rejeitar:', error);
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});