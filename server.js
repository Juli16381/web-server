try {
    const express = require('express');
    const mysql = require('mysql2');
    const bodyParser = require('body-parser');
    const http = require('http');
    const socketIo = require('socket.io');

    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    app.use(bodyParser.json());

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

    // Ruta para recibir datos desde el sniffer
    app.post('/api/data', (req, res) => {
        const { Latitud, Longitud, Fecha, Hora } = req.body;

        const query = 'INSERT INTO datos_gps (Latitud, Longitud, Fecha, Hora) VALUES (?, ?, ?, ?)';
        db.execute(query, [Latitud, Longitud, Fecha, Hora], (err, results) => {
            if (err) {
                console.error('Error al insertar datos en la base de datos:', err);
                res.status(500).send('Error al insertar datos.');
                return;
            }
            console.log('Datos insertados en la base de datos:', results);
            io.emit('new-data', { Latitud, Longitud, Fecha, Hora });  // Emite un evento cuando llegan nuevos datos
            res.status(200).send('Datos recibidos e insertados correctamente.');
        });
    });

    // Ruta para servir la página web
    app.get('/', (req, res) => {
        res.sendFile(__dirname + '/index.html');
    });

    // Iniciar el servidor
    server.listen(3000, '0.0.0.0', () => {
        console.log('Servidor escuchando en el puerto 3000');
    });

} catch (error) {
    console.error('Error al iniciar el servidor:', error);
}

