const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
const PORT = 1010; // Cambia el puerto si es necesario

// Configuración de la base de datos MySQL
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Paocuentas1',
  database: 'app'
};

// Crear la conexión a la base de datos
const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos: ', err);
    return;
  }
  console.log('Conexión a la base de datos MySQL establecida.');
});

// Middleware
app.use(cors());
app.use(express.json());

// Ruta para obtener los datos más recientes de la base de datos
app.get('/get-coordinates', (req, res) => {
  const query = 'SELECT Latitud, Longitud, Fecha, Hora FROM tables ORDER BY id DESC LIMIT 1';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener datos de la base de datos: ', err);
      res.status(500).json({ error: 'Error al consultar la base de datos' });
    } else if (results.length > 0) {
      const data = results[0];
      res.json({
        Latitud: data.Latitud,
        Longitud: data.Longitud,
        Fecha: data.Fecha,
        Hora: data.Hora
      });
    } else {
      res.json({ error: 'No hay datos disponibles' });
    }
  });
});

// Ruta para servir el archivo HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/pag.html');
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(Servidor ejecutándose en http://localhost:${PORT});
});