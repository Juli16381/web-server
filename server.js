const express = require('express');
const mysql = require('mysql2');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

console.log("El servidor está iniciando...");

// Configuración de la base de datos MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Bebe200',
    database: 'mi_base_de_datos'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos MySQL:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL.');
});

let lastProcessedId = null; // Variable para almacenar el último ID procesado

// Función para verificar la base de datos en busca de nuevos datos
function checkForNewData() {
    let query = 'SELECT * FROM datos_gps ORDER BY id DESC LIMIT 1'; // Suponiendo que tienes una columna `id` autoincremental

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            return;
        }

        if (results.length > 0) {
            const latestData = results[0];

            // Compara si el ID de la última fila es mayor que el último procesado
            if (lastProcessedId === null || latestData.id > lastProcessedId) {
                lastProcessedId = latestData.id; // Actualiza el último ID procesado
                console.log('Nuevos datos encontrados:', latestData);

                // Emitir el evento `new-data`
                io.emit('new-data', {
                    Latitud: latestData.Latitud,
                    Longitud: latestData.Longitud,
                    Fecha: latestData.Fecha,
                    Hora: latestData.Hora
                });
            }
        }
    });
}

// Configurar el temporizador para verificar cada 5 segundos (5000 ms)
setInterval(checkForNewData, 5000);

// Ruta para servir la página web
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Iniciar el servidor
server.listen(3000, '0.0.0.0', () => {
    console.log('Servidor escuchando en el puerto 3000');
});
