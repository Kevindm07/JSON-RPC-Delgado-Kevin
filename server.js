const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const app = express();

app.use(bodyParser.json());

const PORT = 3000;

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'JSON',
  password: '12345',
  port: 5432,
});

// --- Funciones de métodos JSON-RPC ---

async function sumar(params) {
  if (params.length !== 2 || typeof params[0] !== 'number' || typeof params[1] !== 'number') {
    throw new Error('Parámetros inválidos para sumar. Se esperan dos números.');
  }
  return params[0] + params[1];
}

async function listarUsuarios() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT id, nombre, email FROM usuarios ORDER BY id ASC');
    return result.rows;
  } catch (error) {
    console.error('Error al listar usuarios:', error.message);
    throw new Error('Error interno al obtener usuarios.');
  } finally {
    if (client) client.release();
  }
}

async function agregarProducto(params) {
  if (!params || typeof params.nombre !== 'string' || typeof params.precio !== 'number' || typeof params.stock !== 'number') {
    throw new Error('Parámetros inválidos para agregarProducto. Se esperan: nombre (string), precio (number), stock (number).');
  }

  const { nombre, precio, stock } = params;
  let client;
  try {
    client = await pool.connect();
    const query = `
      INSERT INTO productos (nombre, precio, stock)
      VALUES ($1, $2, $3)
      RETURNING id, nombre, precio, stock;
    `;
    const values = [nombre, precio, stock];
    const result = await client.query(query, values);
    return { message: 'Producto agregado exitosamente', producto: result.rows[0] };
  } catch (error) {
    console.error('Error al agregar producto:', error.message);
    throw new Error('Error interno al agregar el producto.');
  } finally {
    if (client) client.release();
  }
}

async function listarProductos() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT id, nombre, precio, stock FROM productos ORDER BY id ASC');
    return result.rows;
  } catch (error) {
    console.error('Error al listar productos:', error.message);
    throw new Error('Error interno al obtener productos.');
  } finally {
    if (client) client.release();
  }
}

// --- Endpoint para manejar peticiones JSON-RPC ---
app.post('/rpc', async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0' || typeof method !== 'string' || id === undefined) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: id || null
    });
  }

  let result;
  let error = null;

  try {
    switch (method) {
      case 'sumar':
        result = await sumar(params);
        break;
      case 'listarUsuarios':
        result = await listarUsuarios();
        break;
      case 'agregarProducto':
        result = await agregarProducto(params);
        break;
      case 'listarProductos':
        result = await listarProductos();
        break;
      default:
        error = { code: -32601, message: 'Method not found' };
        break;
    }
  } catch (err) {
    error = { code: -32000, message: err.message };
    console.error(`Error en método "${method}":`, err.message);
  }

  if (error) {
    return res.status(error.code === -32601 ? 404 : 500).json({
      jsonrpc: '2.0',
      error: error,
      id: id
    });
  } else {
    if (id === null) {
      return res.status(204).send();
    }
    return res.json({
      jsonrpc: '2.0',
      result: result,
      id: id
    });
  }
});

// --- Lógica de conexión a la DB y arranque del servidor ---
async function startServer() {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL!');
    client.release();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor Express en http://localhost:${PORT}`);
      console.log(`Servicio JSON-RPC en http://localhost:${PORT}/rpc`);
    });

  } catch (err) {
    console.error('❌ Error al conectar a PostgreSQL:', err.message);
    console.error('Verifica DB, credenciales, host/puerto y firewall.');
    process.exit(1);
  }
}

startServer();