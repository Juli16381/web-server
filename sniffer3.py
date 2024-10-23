import obd
import mysql.connector
from datetime import datetime
import requests
import json
import gpsd  # Librería para obtener la ubicación GPS

# Cargar credenciales desde el archivo credenciales.json
with open('/home/ubuntu/todoproyect/credenciales.json', 'r') as f:
    credenciales = json.load(f)

# Usar las credenciales para la configuración de la base de datos
DB_CONFIG = {
    'user': credenciales['DB_USER'],
    'password': credenciales['DB_PASSWORD'],
    'host': credenciales['DB_HOST'],
    'database': credenciales['DB_NAME'],
    'port': 3306,
    'auth_plugin': 'mysql_native_password',
    'ssl_disabled': True
}

NODEJS_SERVER_URL = credenciales['DB_NODEJS']  # URL del servidor Node.js

# Conectar con el GPS 
gpsd.connect()

def obtener_ubicacion():
    try:
        packet = gpsd.get_current()
        return {
            'latitud': packet.lat,
            'longitud': packet.lon
        }
    except Exception as e:
        print(f"Error al obtener datos GPS: {e}")
        return None

def leer_datos_obd():
    # Conecta al ELM327 a través de Bluetooth y obtiene datos OBD-II.
    try:
        connection = obd.OBD("/dev/rfcomm0")  # Para Linux

        if connection.is_connected():
            #  Leer RPM 
            obd_rpm = obd.commands.RPM
            response_rpm = connection.query(obd_rpm)

            if response_rpm.value:
                # Obtener la ubicación del vehículo
                ubicacion = obtener_ubicacion()
                if ubicacion:
                    # Preparar datos para insertar en la base de datos
                    datos = {
                        'RPM': response_rpm.value.magnitude,
                        'Fecha': datetime.now().strftime('%Y-%m-%d'),
                        'Hora': datetime.now().strftime('%H:%M:%S'),
                        'Latitud': ubicacion['latitud'],
                        'Longitud': ubicacion['longitud']
                    }
                    print(f"Datos obtenidos: {datos}")
                    enviar_a_nodejs(datos)
                    insertar_en_mysql(datos)
                else:
                    print("No se pudo obtener la ubicación.")
            else:
                print("No se obtuvieron datos válidos del adaptador OBD.")
        else:
            print("No se pudo conectar al adaptador OBD-II.")

    except Exception as e:
        print(f"Error al leer datos OBD-II: {e}")

def enviar_a_nodejs(datos):
    # Envía los datos al servidor Node.js mediante una solicitud POST.
    try:
        print(f"Enviando datos a Node.js: {datos}")
        response = requests.post(NODEJS_SERVER_URL, json=datos)
        if response.status_code == 200:
            print("Datos enviados correctamente al servidor Node.js.")
        else:
            print(f"Error al enviar datos al servidor Node.js: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"Excepción al enviar datos al servidor Node.js: {e}")

def insertar_en_mysql(datos):
    # Inserta los datos en una nueva tabla en la base de datos MySQL.
    try:
        print(f"Insertando datos en MySQL: {datos}")

        cnx = mysql.connector.connect(**DB_CONFIG)
        cursor = cnx.cursor()

        # Asegúrate de que la tabla 'datos_obd' tenga columnas para latitud y longitud
        add_dato = ("INSERT INTO datos_obd "
                    "(RPM, Fecha, Hora, Latitud, Longitud) "
                    "VALUES (%s, %s, %s, %s, %s)")
        data_dato = (datos['RPM'], datos['Fecha'], datos['Hora'], datos['Latitud'], datos['Longitud'])

        cursor.execute(add_dato, data_dato)
        cnx.commit()

        print("Datos insertados correctamente en la nueva tabla MySQL.")
        cursor.close()
        cnx.close()

    except mysql.connector.Error as err:
        print(f"Error al insertar en MySQL: {err}")
    except Exception as e:
        print(f"Otro error ocurrió al insertar en MySQL: {e}")

def main():
    """
    Función principal que inicia la lectura de datos OBD-II.
    """
    print("Iniciando lectura de datos OBD-II...")
    while True:
        leer_datos_obd()

if __name__ == "__main__":
    main()
