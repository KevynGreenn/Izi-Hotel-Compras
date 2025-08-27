//aaaa
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

// Configuração do CORS que permite o acesso do seu site
const corsOptions = {
  origin: "https://kevyngreenn.github.io",
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- NOVA FUNÇÃO DE E-MAIL PARA O ADMIN ---
async function enviarEmailConfirmacaoAdmin(requisicao) {
  const adminEmail = "kevynwpantunes2@gmail.com";

  let dataFormatada = 'N/A';
  if (requisicao.data_pagamento) {
    const data = new Date(requisicao.data_pagamento);
    const dataUTC = new Date(data.valueOf() + data.getTimezoneOffset() * 60000);
    dataFormatada = dataUTC.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const detalhesHtml = `
        <ul style="list-style-type: none; padding: 0; font-family: sans-serif; color: #333;">
            <li style="margin-bottom: 10px;"><strong>ID da Requisição:</strong> #${requisicao.token.substring(0, 6)}</li>
            <li style="margin-bottom: 10px;"><strong>Status:</strong> <span style="color: green; font-weight: bold;">${requisicao.status}</span></li>
            <li style="margin-bottom: 10px;"><strong>Solicitante:</strong> ${requisicao.nome_solicitante || 'N/A'}</li>
            <li style="margin-bottom: 10px;"><strong>Contato:</strong> ${requisicao.telefone || 'N/A'}</li>
            <li style="margin-bottom: 10px;"><strong>Centro de Custo:</strong> ${requisicao.centro_custo || 'N/A'}</li>
            <li style="margin-bottom: 10px;"><strong>Valor:</strong> R$ ${requisicao.valor || 'N/A'}</li>
            <li style="margin-bottom: 10px;"><strong>Data do Pagamento:</strong> ${dataFormatada}</li>
            <li style="margin-bottom: 10px;"><strong>Forma de Pagamento:</strong> ${requisicao.opcao_pagamento || 'N/A'}</li>
            ${requisicao.opcao_pagamento === 'Pix' ? `
                <li style="margin-bottom: 10px;"><strong>PIX do Fornecedor:</strong> ${requisicao.pix_fornecedor || 'N/A'}</li>
                <li style="margin-bottom: 10px;"><strong>Nome do Fornecedor:</strong> ${requisicao.nome_fornecedor || 'N/A'}</li>
            ` : ''}
        </ul>
        <p><strong>Descrição Completa:</strong></p>
        <p style="white-space: pre-wrap; border: 1px solid #ddd; padding: 10px; border-radius: 5px; background-color: #f9f9f9;">${requisicao.descricao || 'N/A'}</p>
    `;

  const msg = {
    to: adminEmail,
    from: 'kevynwpantunes2@gmail.com', // SEU E-MAIL VERIFICADO NO SENDGRID
    subject: `Requisição Aprovada: #${requisicao.token.substring(0, 6)} - ${requisicao.nome_solicitante}`,
    html: `
            <p>A seguinte requisição de compra foi <strong>APROVADA</strong>:</p>
            ${detalhesHtml}
        `,
  };

  try {
    await sgMail.send(msg);
    console.log(`E-mail de confirmação de aprovação enviado para ${adminEmail}`);
  } catch (error) {
    console.error('Erro ao enviar e-mail de confirmação:', error.response ? error.response.body : error);
  }
}

// --- ROTAS DA API ---

// Criar requisição
// Criar requisição
app.post('/api/requisicao', async (req, res) => {
  try {
    const { nome, email, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    const query = `
      INSERT INTO requisicoes (nome_solicitante, email_solicitante, telefone, descricao, centro_custo, valor, data_pagamento, opcao_pagamento, pix_fornecedor, nome_fornecedor, status, token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pendente', $11) RETURNING token`;
    const result = await pool.query(query, [nome, email, telefone, descricao, centroCusto, valor, dataPagamento, opcaoPagamento, pix, fornecedor, token]);

    // ✅ Link fixado corretamente
    res.status(201).json({ 
        token: result.rows[0].token,
        frontend_url: "https://kevyngreenn.github.io/Izi-Hotel-Compras"
    });
  } catch (error) {
    console.error('Erro ao criar requisição:', error);
    res.status(500).json({ message: 'Erro no servidor ao criar requisição.' });
  }
});


// Buscar requisição (para a página de aprovação)
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

    // Envia o e-mail detalhado para o admin APENAS na aprovação
    await enviarEmailConfirmacaoAdmin(result.rows[0]);

    res.status(200).json({ message: 'Requisição aprovada com sucesso! O administrador foi notificado.' });
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