from scapy.all import sniff, UDP, IP
import requests
import mysql.connector
from datetime import datetime

# Configuración
INTERFACE = "Wi-Fi"  # Interfaz de red a monitorear (ajusta según tu entorno)
FILTER_IP = "192.168.1.11"  # Rango de red privada (ajusta según tu entorno)
FILTER_PORT = 10000  # Puerto específico a filtrar (ajusta según tu requerimiento)
NODEJS_SERVER_URL = "http://localhost:3000/api/data"  # URL del servidor Node.js

# Configuración de la base de datos MySQL
DB_CONFIG = {
    'user': 'root',
    'password': 'Bebe200',
    'host': 'localhost',
    'database': 'mi_base_de_datos',
    'raise_on_warnings': True
}

def procesar_paquete(paquete):
    print("Paquete capturado")  # Para verificar que se captura un paquete
    try:
        if paquete.haslayer(UDP) and paquete.haslayer(IP):
            udp_layer = paquete.getlayer(UDP)
            ip_layer = paquete.getlayer(IP)

            # Filtrar por IP de destino y puerto
            if ip_layer.dst.startswith(FILTER_IP.split('/')[0]) and udp_layer.dport == FILTER_PORT:
                # Extraer el payload del paquete
                payload = paquete[UDP].payload.load.decode('utf-8')

                # Verificar el contenido del payload
                print(f"Payload capturado: {payload}")

                # Procesar el payload
                datos = parsear_payload(payload)

                if datos:
                    print(f"Datos extraídos: {datos}")  # Verificar los datos extraídos
                    enviar_a_nodejs(datos)
                    insertar_en_mysql(datos)
                else:
                    print("Datos no válidos para inserción.")
    except Exception as e:
        print(f"Error al procesar el paquete: {e}")

def parsear_payload(payload):
    """
    Parsea la carga útil del paquete para extraer Latitud, Longitud, Fecha y Hora
    desde un formato de texto plano.
    """
    try:
        # Dividir el payload por líneas
        lineas = payload.splitlines()
        
        # Crear un diccionario para almacenar los datos
        datos = {}

        # Iterar sobre cada línea y extraer los valores
        for linea in lineas:
            clave, valor = linea.split(':', 1)  # Limitar el split al primer ':'
            datos[clave.strip()] = valor.strip()

        # Validar que todos los datos necesarios estén presentes
        latitud = datos.get('Latitud')
        longitud = datos.get('Longitud')
        timestamp = datos.get('Timestamp')

        if latitud and longitud and timestamp:
            # Dividir el timestamp en fecha y hora
            fecha, hora = timestamp.split(' ')
            print(f"Datos válidos extraídos: Latitud={latitud}, Longitud={longitud}, Fecha={fecha}, Hora={hora}")
            return {
                'Latitud': float(latitud),
                'Longitud': float(longitud),
                'Fecha': fecha,
                'Hora': hora
            }
        else:
            print("Datos incompletos en el payload.")
            return None

    except Exception as e:
        print(f"Error al procesar el payload: {e}")
        return None



def enviar_a_nodejs(datos):
    """
    Envía los datos al servidor Node.js mediante una solicitud POST.
    """
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
    """
    Inserta los datos en la base de datos MySQL.
    """
    try:
        print(f"Insertando datos en MySQL: {datos}")  # Verificar que se están intentando insertar datos

        cnx = mysql.connector.connect(**DB_CONFIG)
        cursor = cnx.cursor()

        add_dato = ("INSERT INTO datos_gps "
                    "(Latitud, Longitud, Fecha, Hora) "
                    "VALUES (%s, %s, %s, %s)")
        data_dato = (datos['Latitud'], datos['Longitud'], datos['Fecha'], datos['Hora'])

        cursor.execute(add_dato, data_dato)
        cnx.commit()

        print("Datos insertados correctamente en la base de datos MySQL.")  # Verificar que se han insertado datos

        cursor.close()
        cnx.close()

    except mysql.connector.Error as err:
        print(f"Error al insertar en MySQL: {err}")  # Capturar y mostrar cualquier error durante la inserción

    except Exception as e:
        print(f"Otro error ocurrió al insertar en MySQL: {e}")  # Capturar cualquier otro tipo de error


def main():
    """
    Función principal que inicia el sniffer.
    """
    print("Iniciando sniffer de paquetes...")
    # Construir el filtro de BPF para scapy
    filtro_bpf = f"udp and dst port {FILTER_PORT} and net {FILTER_IP}"
    sniff(iface=INTERFACE, filter=filtro_bpf, prn=procesar_paquete, store=0)

if __name__ == "__main__":
    main()

