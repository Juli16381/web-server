const express = require('express');
const mysql = require('mysql2');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs'); // Asegúrate de importar fs para leer archivos

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let db;  // Definir db globalmente

console.log("El servidor está iniciando...");

// Cargar credenciales desde el archivo credenciales.json
fs.readFile('/home/ubuntu/todoproyect/credenciales.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error al leer el archivo credenciales.json:', err);
        return;
    }

    // Parsear el archivo JSON para obtener las credenciales
    const credenciales = JSON.parse(data);

    // Configuración de la base de datos MySQL
    const DB_CONFIG = {
        user: credenciales.DB_USER,        // Usuario desde credenciales.json
        password: credenciales.DB_PASSWORD, // Contraseña desde credenciales.json
        host: credenciales.DB_HOST,        // Host desde credenciales.json
        database: credenciales.DB_NAME,    // Nombre de la base de datos desde credenciales.json
        port: 3306,                        // Puerto de MySQL, normalmente 3306
        ssl: false                         // Desactivar SSL
    };

    // Crear la conexión a la base de datos
    db = mysql.createConnection(DB_CONFIG);

    db.connect((err) => {
        if (err) {
            console.error('Error conectando a la base de datos MySQL:', err);
            return;
        }
        console.log('Conectado a la base de datos MySQL.');
    });
});

let lastProcessedId = null;

// Función para verificar la base de datos en busca de nuevos datos
function checkForNewData() {
    if (!db) {
        console.error('La conexión a la base de datos aún no está lista.');
        return;
    }

    let query = 'SELECT * FROM datos_gps ORDER BY id DESC LIMIT 1';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            return;
        }

        if (results.length > 0) {
            const latestData = results[0];
            
            if (lastProcessedId === null || latestData.id > lastProcessedId) {
                lastProcessedId = latestData.id;
                console.log('Nuevos datos encontrados:', latestData);
		 // Formatear la fecha correctamente
                const fechaFormateada = new Date(latestData.Fecha).toISOString().split('T')[0];

                io.emit('new-data', {
                    Latitud: latestData.Latitud,
                    Longitud: latestData.Longitud,
                    Fecha: fechaFormateada,
                    Hora: latestData.Hora
                });
            }
        }
    });
}

// Verificar la base de datos cada 5 segundos
setInterval(checkForNewData, 5000);

// Ruta para servir la página web
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Endpoint para obtener datos históricos
app.get('/historicos', (req, res) => {
    if (!db) {
        console.error('La conexión a la base de datos aún no está lista.');
        res.status(500).send('La conexión a la base de datos no está lista');
        return;
    }

    let query = 'SELECT * FROM datos_gps ORDER BY Hora DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            res.status(500).send('Error al consultar la base de datos');
            return;
        }
        res.json(results);
    });
});

// Iniciar el servidor
server.listen(80, '0.0.0.0', () => {
    console.log('Servidor escuchando en el puerto 80');
});

