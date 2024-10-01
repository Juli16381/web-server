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

                        const fechaFormateada = fechaHora.toISOString().split('T')[0]; // Formatear fecha como "YYYY-MM-DD"
                        const horaFormateada = fechaHora.toTimeString().split(' ')[0];  // Obtener solo la hora

                        io.emit('new-data', {
                            Latitud: latestData.Latitud,
                            Longitud: latestData.Longitud,
                            Fecha: fechaFormateada, // Formato correcto de la fecha
                            Hora: horaFormateada    // Formato correcto de la hora
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
        res.sendFile(__dirname + '/index.html');
    });

    // Ruta para obtener el nombre de usuario desde las credenciales
    app.get('/name', (req, res) => {
        const nombreUsuario = credenciales.DB_NOMBRE;  // Usar el nombre del archivo de credenciales
        res.json({ name: nombreUsuario });
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

            // Formatear la fecha para que siempre sea "YYYY-MM-DD"
            const formattedResults = results.map(row => ({
                ...row,
                Fecha: new Date(row.FechaHora).toISOString().split('T')[0],  // Formatear fecha
                Hora: new Date(row.FechaHora).toTimeString().split(' ')[0]   // Formatear hora
            }));

            res.json(formattedResults);
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
                // Formatear la fecha para que siempre sea "YYYY-MM-DD"
                const formattedResults = results.map(row => ({
                    ...row,
                    Fecha: new Date(row.FechaHora).toISOString().split('T')[0],  // Formatear fecha
                    Hora: new Date(row.FechaHora).toTimeString().split(' ')[0]   // Formatear hora
                }));

                res.json(formattedResults);
            }
        });
    });

    // Ruta para mostrar los datos históricos en tabla (ruta escondida)
    app.get('/datos', (req, res) => {
        let query = 'SELECT * FROM datos_gps ORDER BY FechaHora DESC, id DESC';
        
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error al consultar la base de datos:', err);
                res.status(500).send('Error al consultar la base de datos');
                return;
            }

            // Renderizar los datos en una tabla HTML
            let html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Historial de Datos GPS</title>
                <style>
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        text-align: center;
                    }
                    th, td {
                        border: 1px solid black;
                        padding: 8px;
                    }
                    th {
                        background-color: #ce72c0;
                        color: white;
                    }
                </style>
            </head>
            <body>
                <h1>Historial de Datos GPS</h1>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Latitud</th>
                            <th>Longitud</th>
                            <th>Fecha</th>
                            <th>Hora</th>
                        </tr>
                    </thead>
                    <tbody>`;

            // Llenar la tabla con los datos
            results.forEach((row) => {
                const fechaFormateada = new Date(row.FechaHora).toLocaleDateString('es-ES');
                const horaFormateada = new Date(row.FechaHora).toTimeString().split(' ')[0];
                html += `
                <tr>
                    <td>${row.id}</td>
                    <td>${row.Latitud}</td>
                    <td>${row.Longitud}</td>
                    <td>${fechaFormateada}</td>  
                    <td>${horaFormateada}</td>  
                </tr>`;
            });

            html += `
                    </tbody>
                </table>
            </body>
            </html>`;

            res.send(html);  // Enviar la tabla al navegador
        });
    });

    // Ruta para obtener el historial por lugar
    app.get('/historicoPorLugar', (req, res) => {
        const latitudSeleccionada = parseFloat(req.query.lat);
        const longitudSeleccionada = parseFloat(req.query.lng);

        // Parámetro de distancia máxima en grados (aprox. 0.01 ~ 1km)
        const distanciaMaxima = 0.001;

        const query = `
            SELECT * FROM datos_gps
            WHERE ABS(Latitud - ?) <= ? AND ABS(Longitud - ?) <= ?
            ORDER BY FechaHora DESC
        `;

        db.query(query, [latitudSeleccionada, distanciaMaxima, longitudSeleccionada, distanciaMaxima], (err, results) => {
            if (err) {
                console.error('Error al consultar la base de datos:', err);
                res.status(500).send('Error al consultar la base de datos');
                return;
            }

            res.json(results);
        });
    });

    // Iniciar el servidor en el puerto 80
    server.listen(80, '0.0.0.0', () => {
        console.log('Servidor escuchando en el puerto 80');
    });
});
