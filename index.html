<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="viewport" content="width=device-width, initial-scale=1.0">
    <title id="name-title">Datos GPS</title>
    <script>
    // Función para obtener el nombre del servidor y actualizar el título
        function fetchName() {
            fetch('/name')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('name-title').textContent = data.name;  // Solo el nombre
                })
                .catch(err => console.error("Error al obtener el nombre:", err));
        }

        // Ejecutar la función cuando la página cargue
        document.addEventListener('DOMContentLoaded', fetchName);
    </script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    <style>
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 0;
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
        }
        .container {
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: flex-start;
            margin-top: 10px;
            width: 90%;
        }
        #map {
            height: 450px;
            width: 98%;
            border: 2px solid #ce72c0;
            margin-right: 20px;
            position: relative;
        }
        .data-container {
            width: 35%;
        }
        .title {
            font-size: 22px;
            color: #333;
            margin-bottom: 7px;
        }
        .leaflet-control {
            background-color: white;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
        }
        /* Botón sobrio */
        #toggle-filter-btn {
            padding: 8px 16px;
            background-color: #ce72c0;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 14px;
            margin-bottom: 7px;
            border-radius: 5px;
        }
        /* Ocultar inicialmente el formulario */
        #filterForm {
            display: none;
            margin-bottom: 15px;
        }

        /* Estilo del slider */
        #slider {
            width: 100%;
            margin-top: 10px;
        }

        /* Información del marcador del slider */
        .slider-info {
            margin-top: 5px;
            font-size: 14px;
            color: #333;
        }

        /* Media query para pantallas móviles */
        @media (max-width: 768px) {
            .container {
                flex-direction: column;
                align-items: center;
            }
            #map {
                width: 90%;
                margin-right: 0;
                margin-bottom: 20px;
            }
            .data-container {
                width: 90%;
            }
        }
    </style>
</head>
<body>
    <h1 class="title">Datos GPS</h1>

    <!-- Botón para mostrar/ocultar el formulario de filtrado -->
    <button id="toggle-filter-btn">Filtrar información</button>

    <!-- Formulario de filtrado -->
    <form id="filterForm">
        <label for="startDate">Fecha y hora de inicio:</label>
        <input type="datetime-local" id="startDate" name="startDate">
        <label for="endDate">Fecha y hora de fin:</label>
        <input type="datetime-local" id="endDate" name="endDate">
        <button type="submit">Filtrar</button>
    </form>

    <div class="container">
        <!-- Contenedor para el Mapa -->
        <div id="map"></div>
    </div>

    <!-- Slider para el marcador -->
    <div id="sliderContainer" style="display: none;">
        <input type="range" id="slider" min="0" max="100" step="1" value="0">
        <div class="slider-info">
            <p id="latitud-info">Latitud: -</p>
            <p id="longitud-info">Longitud: -</p>
            <p id="timestamp-info">Timestamp: -</p>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const now = new Date();
            const oneHourBefore = new Date(now.getTime() - 60 * 60 * 1000);
            const formatDateTimeLocal = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            };

            document.getElementById('startDate').value = formatDateTimeLocal(oneHourBefore);
            document.getElementById('endDate').value = formatDateTimeLocal(now);

            document.getElementById('toggle-filter-btn').addEventListener('click', function() {
                const filterForm = document.getElementById('filterForm');
                filterForm.style.display = filterForm.style.display === 'none' || filterForm.style.display === '' ? 'block' : 'none';
            });

            const socket = io();
            let autoCenter = true;
            let filtrando = false;
            let recorridoFiltradoPuntos = [];
            let marcadorSlider = null;

            const map = L.map('map').setView([0, 0], 13);
            map.on('movestart', function() {
                autoCenter = false;
                setTimeout(function() {
                    autoCenter = true;
                }, 10000);
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            let ultimaUbicacionControl = L.control({position: 'bottomleft'});
            ultimaUbicacionControl.onAdd = function(map) {
                const div = L.DomUtil.create('div', 'leaflet-control');
                div.id = 'ultima-ubicacion-info';
                div.innerHTML = `
                    <b>Última ubicación</b><br>
                    Latitud: <span id="ultima-latitud">-</span><br>
                    Longitud: <span id="ultima-longitud">-</span><br>
                    Fecha: <span id="ultima-fecha">-</span><br>
                    Hora: <span id="ultima-hora">-</span>
                `;
                return div;
            };
            ultimaUbicacionControl.addTo(map);

            let recorrido = L.polyline([], { color: '#800080' }).addTo(map);
            let recorridoFiltrado = L.polyline([], { color: '#50C878' });

            let marcadorUltimaUbicacion = L.circleMarker([0, 0], {
                radius: 10,
                color: '#800080',
                fillColor: '#800080',
                fillOpacity: 1,
            }).addTo(map);

            socket.on('new-data', (data) => {
                if (!filtrando) {
                    actualizarMapa(data);
                }
            });

            function actualizarMapa(data) {
                const nuevaLatitud = parseFloat(data.Latitud);
                const nuevaLongitud = parseFloat(data.Longitud);
                if (nuevaLatitud && nuevaLongitud) {
                    marcadorUltimaUbicacion.setLatLng([nuevaLatitud, nuevaLongitud]);
                    if (autoCenter) {
                        map.setView([nuevaLatitud, nuevaLongitud], 13);
                    }
                }
            }

            document.getElementById('filterForm').addEventListener('submit', function(event) {
                event.preventDefault();
                const startDate = new Date(document.getElementById('startDate').value);
                const endDate = new Date(document.getElementById('endDate').value);

                filtrando = true;
                map.removeLayer(recorrido);
                fetch(`/filterData?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
                    .then(response => response.json())
                    .then(data => {
                        recorridoFiltrado.setLatLngs([]);
                        recorridoFiltradoPuntos = [];
                        data.forEach((registro) => {
                            const lat = parseFloat(registro.Latitud);
                            const lon = parseFloat(registro.Longitud);
                            recorridoFiltrado.addLatLng([lat, lon]);
                            recorridoFiltradoPuntos.push({
                                Latitud: lat,
                                Longitud: lon,
                                FechaHora: `${registro.Fecha} ${registro.Hora}`
                            });
                        });
                        recorridoFiltrado.addTo(map);
                        if (recorridoFiltradoPuntos.length > 0) {
                            const firstPoint = [recorridoFiltradoPuntos[0].Latitud, recorridoFiltradoPuntos[0].Longitud];
                            map.setView(firstPoint, 13);
                            document.getElementById('slider').max = recorridoFiltradoPuntos.length - 1;
                            document.getElementById('sliderContainer').style.display = 'block';
                        }
                    });
            });

            // Slider logic for moving marker
            document.getElementById('slider').addEventListener('input', function() {
                const index = parseInt(this.value);
                const punto = recorridoFiltradoPuntos[index];
                if (punto) {
                    if (!marcadorSlider) {
                        marcadorSlider = L.marker([punto.Latitud, punto.Longitud]).addTo(map);
                    } else {
                        marcadorSlider.setLatLng([punto.Latitud, punto.Longitud]);
                    }
                    document.getElementById('latitud-info').textContent = `Latitud: ${punto.Latitud}`;
                    document.getElementById('longitud-info').textContent = `Longitud: ${punto.Longitud}`;
                    document.getElementById('timestamp-info').textContent = `Timestamp: ${punto.FechaHora}`;
                    map.setView([punto.Latitud, punto.Longitud], 13);
                }
            });
        });
    </script>
</body>
</html>
