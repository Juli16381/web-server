const express = require('express');
const mysql = require('mysql2');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs'); // Ensure fs is imported

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let db;  // Define db globally
let lastProcessedId = null; // Initialize lastProcessedId

console.log("El servidor está iniciando...");

// Load credentials from credenciales.json
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
                        const fechaHoraStr = `${latestData.Fecha} ${latestData.Hora}`;
                        console.log('Fecha y Hora combinadas:', fechaHoraStr);

                        const fechaHora = new Date(fechaHoraStr);
                        console.log('FechaHora como Date:', fechaHora);

                        const fechaFormateada = fechaHora.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        });
                        const horaFormateada = fechaHora.toTimeString().split(' ')[0];

                        const fechaHoraFormateada = `${fechaFormateada} ${horaFormateada}`;
                        console.log('FechaHora formateada:', fechaHoraFormateada);

                        io.emit('new-data', {
                            Latitud: latestData.Latitud,
                            Longitud: latestData.Longitud,
                            FechaHora: fechaHoraFormateada
                        });
                    } catch (error) {
                        console.error('Error al formatear la fecha y hora:', error);
                    }
                }
            }
        });
    }

    setInterval(checkForNewData, 5000);

    app.get('/', (req, res) => {
        res.sendFile(__dirname + '/index.html');
    });

    app.get('/historicos', (req, res) => {
        if (!db) {
            console.error('La conexión a la base de datos aún no está lista.');
            res.status(500).send('La conexión a la base de datos no está lista');
            return;
        }

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

    app.get('/filterData', (req, res) => {
        const startDate = new Date(req.query.startDate);
        const endDate = new Date(req.query.endDate);

        console.log('Fechas recibidas:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        startDate.setHours(startDate.getHours() - startDate.getTimezoneOffset() / 60);
        endDate.setHours(endDate.getHours() - endDate.getTimezoneOffset() / 60);

        const formattedStartDate = startDate.toISOString().slice(0, 19).replace('T', ' ');
        const formattedEndDate = endDate.toISOString().slice(0, 19).replace('T', ' ');

        console.log('Fechas formateadas:', {
            formattedStartDate,
            formattedEndDate
        });

        const query = `SELECT * FROM datos_gps WHERE FechaHora BETWEEN ? AND ?`;

        console.log('Consulta SQL:', query);
        console.log('Parámetros:', [formattedStartDate, formattedEndDate]);

        db.query(query, [formattedStartDate, formattedEndDate], (error, results) => {
            if (error) {
                console.error('Error al realizar la consulta:', error);
                res.status(500).json({ error: 'Error al realizar la consulta.' });
            } else {
                console.log('Resultados de la consulta:', results);
                res.json(results);
            }
        });
    });

    // Ensure the server starts listening only after the db connection is established
    server.listen(80, '0.0.0.0', () => {
        console.log('Servidor escuchando en el puerto 80');
    });

}); 
