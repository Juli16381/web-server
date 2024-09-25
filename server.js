const express = require('express');
const mysql = require('mysql2');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let db;
let lastProcessedId = null;

console.log("El servidor está iniciando...");

// Cargar credenciales desde credenciales.json
fs.readFile('/home/ubuntu/todoproyect/credenciales.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error al leer el archivo credenciales.json:', err);
        return;
    }

    const credenciales = JSON.parse(data);

    const DB_CONFIG = {
        user: credenciales.DB_USER,
        password: credenciales.DB_PASSWORD,
        host: credenciales.DB_HOST,
        database: credenciales.DB_NAME,
        port: 3306,
        ssl: false
    };

    db = mysql.createConnection(DB_CONFIG);

    db.connect((err) => {
        if (err) {
            console.error('Error conectando a la base de datos MySQL:', err);
            return;
        }
        console.log('Conectado a la base de datos MySQL.');
    });

    // Función para verificar y emitir nuevos datos
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

                    try {
                        const fechaHora = new Date(latestData.FechaHora);

                        if (isNaN(fechaHora)) {
                            throw new Error('Fecha inválida');
                        }

                        const fechaFormateada = fechaHora.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        });
                        const horaFormateada = fechaHora.toTimeString().split(' ')[0];

                        io.emit('new-data', {
                            Latitud: latestData.Latitud,
                            Longitud: latestData.Longitud,
                            Fecha: fechaFormateada, // Formatear correctamente la fecha
                            Hora: horaFormateada    // Formatear correctamente la hora
                        });
                    } catch (error) {
                        console.error('Error al formatear la fecha y hora:', error);
                    }
                }
            }
        });
    }

    // Verificar nuevos datos cada 5 segundos
    setInterval(checkForNewData, 5000);

    // Ruta para servir la página principal
    app.get('/', (req, res) => {
        res.sendFile(__dirname + '/pag.html');
    });

    // Ruta para obtener los datos históricos
    app.get('/historicos', (req, res) => {
        let query = 'SELECT * FROM datos_gps ORDER BY FechaHora DESC, id DESC';
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error al consultar la base de datos:', err);
                res.status(500).send('Error al consultar la base de datos');
                return;
            }
            res.json(results);
        });
    });

    // Ruta para filtrar los datos entre fechas
    app.get('/filterData', (req, res) => {
        const startDate = new Date(req.query.startDate);
        const endDate = new Date(req.query.endDate);

        console.log('Fechas recibidas:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        const formattedStartDate = startDate.toISOString().slice(0, 19).replace('T', ' ');
        const formattedEndDate = endDate.toISOString().slice(0, 19).replace('T', ' ');

        const query = `SELECT * FROM datos_gps WHERE FechaHora BETWEEN ? AND ?`;
        db.query(query, [formattedStartDate, formattedEndDate], (error, results) => {
            if (error) {
                console.error('Error al realizar la consulta:', error);
                res.status(500).json({ error: 'Error al realizar la consulta.' });
            } else {
                res.json(results);
            }
        });
    });

    // Iniciar el servidor en el puerto 80
    server.listen(80, '0.0.0.0', () => {
        console.log('Servidor escuchando en el puerto 80');
    });
});
