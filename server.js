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
let lastProcessedObdId = null;

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

    // Función para verificar y emitir nuevos datos de datos_gps
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

                        const fechaFormateada = fechaHora.toISOString().split('T')[0];
                        const horaFormateada = fechaHora.toTimeString().split(' ')[0];

                        io.emit('new-data', {
                            carro: '1',
                            Latitud: latestData.Latitud,
                            Longitud: latestData.Longitud,
                            Fecha: fechaFormateada,
                            Hora: horaFormateada
                        });
                    } catch (error) {
                        console.error('Error al formatear la fecha y hora:', error);
                    }
                }
            }
        });
    }

    // Función para verificar y emitir nuevos datos de datos_obd
    function checkForNewObdData() {
        if (!db) {
            console.error('La conexión a la base de datos aún no está lista.');
            return;
        }

        let query = 'SELECT * FROM datos_obd ORDER BY id DESC LIMIT 1';

        db.query(query, (err, results) => {
            if (err) {
                console.error('Error al consultar la base de datos:', err);
                return;
            }

            if (results.length > 0) {
                const latestData = results[0];

                if (lastProcessedObdId === null || latestData.id > lastProcessedObdId) {
                    lastProcessedObdId = latestData.id;
                    console.log('Nuevos datos de OBD encontrados:', latestData);

                    try {
                        const fechaHora = new Date(latestData.FechaHora);

                        if (isNaN(fechaHora)) {
                            throw new Error('Fecha inválida');
                        }

                        const fechaFormateada = fechaHora.toISOString().split('T')[0];
                        const horaFormateada = fechaHora.toTimeString().split(' ')[0];

                        io.emit('new-obd-data', {
                            carro: '2',
                            Latitud: latestData.Latitud,
                            Longitud: latestData.Longitud,
                            Fecha: fechaFormateada,
                            Hora: horaFormateada,
                            rpm: latestData.rpm
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
    setInterval(checkForNewObdData, 5000);

    // Ruta para servir la página principal
    app.get('/', (req, res) => {
        res.sendFile(__dirname + '/index.html');
    });

    // Ruta para obtener los datos históricos de datos_gps
    app.get('/historicos', (req, res) => {
        let query = 'SELECT * FROM datos_gps ORDER BY FechaHora DESC, id DESC';
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error al consultar la base de datos:', err);
                res.status(500).send('Error al consultar la base de datos');
                return;
            }

            const formattedResults = results.map(row => ({
                ...row,
                Fecha: new Date(row.FechaHora).toISOString().split('T')[0],
                Hora: new Date(row.FechaHora).toTimeString().split(' ')[0]
            }));

            res.json(formattedResults);
        });
    });

   // Ruta para obtener datos filtrados por rango de fechas para datos_obd
    app.get('/filterObdData', (req, res) => {
          console.log("se consulta obdfilter");
    const startDate = new Date(req.query.startDate);
    const endDate = new Date(req.query.endDate);

    console.log('Fechas recibidas para OBD:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
    });

    const formattedStartDate = startDate.toISOString().slice(0, 19).replace('T', ' ');
    const formattedEndDate = endDate.toISOString().slice(0, 19).replace('T', ' ');

    const query = `SELECT * FROM datos_obd WHERE FechaHora BETWEEN ? AND ?`;
    db.query(query, [formattedStartDate, formattedEndDate], (error, results) => {
        if (error) {
            console.error('Error al realizar la consulta:', error);
            res.status(500).json({ error: 'Error al realizar la consulta.' });
        } else {
            const formattedResults = results.map(row => ({
                ...row,
                Fecha: new Date(row.FechaHora).toISOString().split('T')[0],
                Hora: new Date(row.FechaHora).toTimeString().split(' ')[0],
                rpm: row.rpm
            }));

            res.json(formattedResults);
        }
    });
});

    // Ruta para obtener todos los datos históricos de datos_obd
    app.get('/historicosObd', (req, res) => {
        console.log("se consulta obd");
    const query = 'SELECT * FROM datos_obd ORDER BY FechaHora DESC, id DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            res.status(500).send('Error al consultar la base de datos');
            return;
        }

        const formattedResults = results.map(row => ({
            ...row,
            Fecha: new Date(row.FechaHora).toISOString().split('T')[0],
            Hora: new Date(row.FechaHora).toTimeString().split(' ')[0],
            rpm: row.rpm
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
                            <th>Carroid</th>
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
                    <td>${row.Carroid}</td>
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

    // Ruta para mostrar los datos históricos de OBD
    app.get('/datosobd', (req, res) => {
    let query = 'SELECT id, Carroid, Latitud, Longitud, FechaHora, rpm FROM datos_obd ORDER BY FechaHora DESC, id DESC';
    
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
            <title>Historial de Datos OBD</title>
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
            <h1>Historial de Datos OBD</h1>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Carroid</th>
                        <th>Latitud</th>
                        <th>Longitud</th>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>RPM</th>
                    </tr>
                </thead>
                <tbody>`;

        // Llenar la tabla con los datos
        results.forEach((row) => {
            const fecha = new Date(row.FechaHora);
            const fechaFormateada = fecha.toLocaleDateString('es-ES');
            const horaFormateada = fecha.toTimeString().split(' ')[0]; // Formato HH:mm:ss
            
            html += `
            <tr>
                <td>${row.id}</td>
                <td>${row.Carroid}</td>
                <td>${row.Latitud}</td>
                <td>${row.Longitud}</td>
                <td>${fechaFormateada}</td>  
                <td>${horaFormateada}</td>  
                <td>${row.rpm}</td>
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



  // Iniciar el servidor en el puerto 80
    server.listen(80, '0.0.0.0', () => {
        console.log('Servidor escuchando en el puerto 80');
    });
});

