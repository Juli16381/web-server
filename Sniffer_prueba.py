# -*- coding: utf-8 -*-

from scapy.all import sniff, UDP, IP
import requests
import mysql.connector
from datetime import datetime
import os
import json

# Configuracion
INTERFACE = "enX0"  # Interfaz de red a monitorear 
FILTER_IP = "172.31.24.118"  # Rango de red privada 
FILTER_PORT = 10000  # Puerto especiÂ­fico a filtrar 
NODEJS_SERVER_URL = "http://52.201.28.44/api/data"  # URL del servidor Node.js


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

                # Verificar el contenido del payload
                print(f"Payload capturado: {payload}")

                # Procesar el payload
                datos = parsear_payload(payload)

                if datos:
                    print(f"Datos extraiÂ­dos: {datos}")  # Verificar los datos extraÃƒÂ­dos
                    enviar_a_nodejs(datos)
                    insertar_en_mysql(datos)
                else:
                    print("Datos no validos para insercion.")
    except Exception as e:
        print(f"Error al procesar el paquete: {e}")

def parsear_payload(payload):
    """
    Parsea la carga util del paquete para extraer Latitud, Longitud, Fecha y Hora
    desde un formato de texto plano.
    """
    try:
        # Dividir el payload por liÂ­neas
        lineas = payload.splitlines()

        # Crear un diccionario para almacenar los datos
        datos = {}

        # Iterar sobre cada lÃƒÂ­nea y extraer los valores
        for linea in lineas:
            clave, valor = linea.split(':', 1)  # Limitar el split al primer ':'
            datos[clave.strip()] = valor.strip()

        # Validar que todos los datos necesarios estan presentes
        latitud = datos.get('Latitud')
        longitud = datos.get('Longitud')
        timestamp = datos.get('Timestamp')

        if latitud and longitud and timestamp:
            # Dividir el timestamp en fecha y hora
            fecha, hora = timestamp.split(' ')
            print(f"Datos validos extraiÂ­dos: Latitud={latitud}, Longitud={longitud}, Fecha={fecha}, Hora={hora}")
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
    EnviÂ­a los datos al servidor Node.js mediante una solicitud POST.
    """
    try:
        print(f"Enviando datos a Node.js: {datos}")
        response = requests.post(NODEJS_SERVER_URL, json=datos)
        if response.status_code == 200:
            print("Datos enviados correctamente al servidor Node.js.")
        else:
            print(f"Error al enviar datos al servidor Node.js: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"Excepcion al enviar datos al servidor Node.js: {e}")

def insertar_en_mysql(datos):
    """
    Inserta los datos en la base de datos MySQL.
    """
    try:
        print(f"Insertando datos en MySQL: {datos}")  # Verificar que se estÃƒÂ¡n intentando insertar datos

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
        print(f"Error al insertar en MySQL: {err}")  # Capturar y mostrar cualquier error durante la inserciÃƒÂ³n

    except Exception as e:
        print(f"Otro error ocurriÃƒÂ³ al insertar en MySQL: {e}")  # Capturar cualquier otro tipo de error



def main():
    """
    Funcion principal que inicia el sniffer.
    """
    print("Iniciando sniffer de paquetes...")
    # Construir el filtro de BPF para scapy
    filtro_bpf = f"udp and dst port {FILTER_PORT} and net {FILTER_IP}"
    sniff(iface=INTERFACE, filter=filtro_bpf, prn=procesar_paquete, store=0)

if __name__ == "__main__":
    main()

