# -*- coding: utf-8 -*-

from scapy.all import sniff, UDP, IP
import requests
import mysql.connector
import json

# Cargar credenciales desde el archivo credenciales.json
with open('/home/ubuntu/todoproyect/credenciales.json', 'r') as f:
    credenciales = json.load(f)

# Configuración
INTERFACE = "enX0"  # Interfaz de red a monitorear 
FILTER_IP = credenciales['DB_IP']  # Rango de red privada 
FILTER_PORT = 10000  # Puerto específico a filtrar 
NODEJS_SERVER_URL = credenciales['DB_NODEJS']  # URL del servidor Node.js

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

def procesar_paquete(paquete):
    print("Paquete capturado")  # Para verificar que se captura un paquete
    try:
        if paquete.haslayer(UDP) and paquete.haslayer(IP):
            udp_layer = paquete.getlayer(UDP)
            ip_layer = paquete.getlayer(IP)

            # Filtrar por IP de destino y puerto
            if ip_layer.dst.startswith(FILTER_IP.split('/')[0]) and udp_layer.dport == FILTER_PORT:
                # Extraer el payload del paquete
                payload = paquete[UDP].payload.load.decode('utf-8', errors='replace')

                # Verificar si el payload está vacío
                if not payload:
                    print("Payload vacío recibido, ignorando el paquete.")
                    return

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

        # Validar que todos los datos necesarios están presentes
        latitud = datos.get('Latitud')
        longitud = datos.get('Longitud')
        timestamp = datos.get('Timestamp')

        if latitud and longitud and timestamp:
            # Dividir el timestamp en fecha y hora
            partes_timestamp = timestamp.split(' ')
            if len(partes_timestamp) == 2:
                fecha, hora = partes_timestamp
                print(f"Datos válidos extraídos: Latitud={latitud}, Longitud={longitud}, Fecha={fecha}, Hora={hora}")
                return {
                    'Latitud': float(latitud),
                    'Longitud': float(longitud),
                    'Fecha': fecha,
                    'Hora': hora,
                    'FechaHora': f"{fecha} {hora}"  # Crear FechaHora
                }
            else:
                print("Formato de timestamp incorrecto.")
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
    Inserta los datos en la base de datos MySQL si no existe un registro duplicado.
    """
    try:
        print(f"Insertando datos en MySQL: {datos}")  # Verificar que se están intentando insertar datos

        cnx = mysql.connector.connect(**DB_CONFIG)
        cursor = cnx.cursor()

        # Concatenar Fecha y Hora para obtener FechaHora
        fecha_hora = f"{datos['Fecha']} {datos['Hora']}"

        # Consulta para verificar si ya existe un registro con los mismos valores
        check_query = ("SELECT COUNT(*) FROM datos_gps WHERE Latitud = %s AND Longitud = %s AND Fecha = %s AND Hora = %s")
        check_data = (datos['Latitud'], datos['Longitud'], datos['Fecha'], datos['Hora'])
        cursor.execute(check_query, check_data)
        result = cursor.fetchone()

        if result[0] == 0:  # Si no existen registros duplicados
            add_dato = ("INSERT INTO datos_gps "
                        "(Latitud, Longitud, Fecha, Hora, FechaHora) "
                        "VALUES (%s, %s, %s, %s, %s)")
            data_dato = (datos['Latitud'], datos['Longitud'], datos['Fecha'], datos['Hora'], fecha_hora)

            cursor.execute(add_dato, data_dato)
            cnx.commit()

            print("Datos insertados correctamente en la base de datos MySQL.")
        else:
            print("El registro ya existe. No se insertaron datos duplicados.")

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


