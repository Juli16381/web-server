# -*- coding: utf-8 -*-

from scapy.all import sniff, UDP, IP
import requests
import mysql.connector
from datetime import datetime
import os
import json
# Cargar credenciales desde el archivo credenciales.json
with open('/home/ubuntu/todoproyect/credenciales.json', 'r') as f:
    credenciales = json.load(f)
    
# Configuracion
INTERFACE = "enX0"  # Interfaz de red a monitorear 
FILTER_IP = credenciales['DB_IP']  # Rango de red privada 
FILTER_PORT = 10000  # Puerto especiÂ­fico a filtrar 
NODEJS_SERVER_URL = credenciales['DB_NODEJS'] # URL del servidor Node.js




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


payload = {
    'Aplicacion': 'App2',
    'Latitud': 11.019651,
    'Longitud': -74.8115981,
    'Fecha': '2024-10-28',
    'Hora': '21:47:28',
    'RPM': 1046
}




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

import mysql.connector

def insertar_en_mysql(datos):
    """
    Inserta los datos en la base de datos MySQL.
    """
    try:
        print(f"Insertando datos en MySQL: {datos}")  # Verificar que se están intentando insertar datos

        cnx = mysql.connector.connect(**DB_CONFIG)
        cursor = cnx.cursor()

        # Insertar en la tabla adecuada según la aplicación
        if datos.get('Aplicacion') == "App1" and 'RPM' not in datos:
            # Insertar en la tabla de datos_gps
            add_dato = ("INSERT INTO datos_gps "
                        "(Latitud, Longitud, Fecha, Hora) "
                        "VALUES (%s, %s, %s, %s)")
            data_dato = (datos['Latitud'], datos['Longitud'], datos['Fecha'], datos['Hora'])

            cursor.execute(add_dato, data_dato)

        elif datos.get('Aplicacion') == "App2" and 'RPM' in datos:
            # Insertar en la tabla de datos_obd
            add_dato = ("INSERT INTO datos_obd "
                        "(Latitud, Longitud, Fecha, Hora, RPM) "
                        "VALUES (%s, %s, %s, %s, %s)")
            data_dato = (datos['Latitud'], datos['Longitud'], datos['Fecha'], datos['Hora'], datos['RPM'])

            cursor.execute(add_dato, data_dato)
        else:
            print("Error: Datos incompletos o incorrectos para la aplicación especificada.")
            return

        # Confirmar los cambios en la base de datos
        cnx.commit()
        print("Datos insertados correctamente en la base de datos MySQL.")

        cursor.close()
        cnx.close()

    except mysql.connector.Error as err:
        print(f"Error al insertar en MySQL: {err}")  # Capturar y mostrar cualquier error durante la inserción

    except Exception as e:
        print(f"Otro error ocurrió al insertar en MySQL: {e}")  # Capturar cualquier otro tipo de error




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
