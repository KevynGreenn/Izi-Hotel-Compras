import express from 'express';
import pkg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(cors());
app.use(express.json());

// Criar requisição
app.post('/api/requisicao', async (req, res) => {
  try {
    const { solicitante, descricao, valor, token } = req.body;
    const query = `
      INSERT INTO requisicoes (solicitante, descricao, valor, status, token)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`;
    const result = await pool.query(query, [solicitante, descricao, valor, 'Pendente', token]);
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
    const query = 'SELECT * FROM requisicoes WHERE token = $1';
    const result = await pool.query(query, [token]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar requisição:', error);
    res.status(500).json({ message: 'Erro no servidor ao buscar requisição.' });
  }
});

// Aprovar requisição
app.post('/api/requisicao/:token/aprovar', async (req, res) => {
  try {
    const { token } = req.params;
    const updateQuery = 'UPDATE requisicoes SET status = $1 WHERE token = $2 RETURNING *';
    const result = await pool.query(updateQuery, ['Aprovada', token]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada.' });
    }

    res.status(200).json({ message: 'Requisição aprovada com sucesso!' });
  } catch (error) {
    console.error('Erro ao aprovar:', error);
    res.status(500).json({ message: 'Erro no servidor ao aprovar a requisição.' });
  }
});

// Rejeitar requisição
app.post('/api/requisicao/:token/rejeitar', async (req, res) => {
  try {
    const { token } = req.params;
    const updateQuery = 'UPDATE requisicoes SET status = $1 WHERE token = $2 RETURNING *';
    const result = await pool.query(updateQuery, ['Rejeitada', token]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Requisição não encontrada.' });
    }

    res.status(200).json({ message: 'Requisição rejeitada.' });
  } catch (error) {
    console.error('Erro ao rejeitar:', error);
    res.status(500).json({ message: 'Erro no servidor ao rejeitar a requisição.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
