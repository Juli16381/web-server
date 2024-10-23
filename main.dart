import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:async';
import 'dart:typed_data';
import 'dart:io'; // Asegúrate de importar esta biblioteca
import 'package:flutter_bluetooth_serial/flutter_bluetooth_serial.dart';
import 'dart:convert';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GPS & OBDII App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const MyHomePage(title: 'GPS & OBDII App'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  String locationMessage = '';
  String rpmData = 'Esperando datos OBDII...';
  Timer? _timer;
  BluetoothConnection? connection;
  List<BluetoothDevice> devices = [];
  BluetoothDevice? deviceToConnect;

  @override
  void initState() {
    super.initState();
    requestBluetoothPermissions(); // Solicitar permisos al iniciar
    startOBDConnection(); // Iniciar conexión OBDII
    startSendingLocationAutomatically(); // Iniciar el envío automático de ubicación
  }

  @override
  void dispose() {
    _timer?.cancel();
    connection?.dispose();
    super.dispose();
  }

  Future<void> requestBluetoothPermissions() async {
    var statusScan = await Permission.bluetoothScan.status;
    if (!statusScan.isGranted) {
      await Permission.bluetoothScan.request();
    }

    var statusConnect = await Permission.bluetoothConnect.status;
    if (!statusConnect.isGranted) {
      await Permission.bluetoothConnect.request();
    }
  }

  void startOBDConnection() async {
    await discoverDevices(); // Iniciar el descubrimiento de dispositivos
  }

  Future<void> discoverDevices() async {
    FlutterBluetoothSerial.instance.startDiscovery().listen((r) {
      if (r.device.name != null &&
          (r.device.name == 'OBDII' || r.device.name == 'OBD')) {
        devices.add(r.device);
        print('Dispositivo encontrado: ${r.device.name}');
      }
    }).onDone(() {
      connectToDevice(); // Conectar después de que termine
    });
  }

  void connectToDevice() async {
    if (devices.isEmpty) {
      print('No se encontraron dispositivos OBDII.');
      return;
    }

    deviceToConnect =
        devices.first; // Intenta conectar con el primer dispositivo encontrado
    try {
      connection =
          await BluetoothConnection.toAddress(deviceToConnect!.address);
      print('Conectado al dispositivo: ${deviceToConnect!.name}');
      print(
          'Comunicación serial establecida, listo para enviar y recibir datos.');

      // Escuchar datos de entrada
      connection!.input!.listen((Uint8List data) {
        handleData(data);
      });

      // Enviar el comando para obtener RPM
      sendRPMCommand();
    } catch (e) {
      print('Error al conectar: $e');
    }
  }

  void sendRPMCommand() {
    String command = '010C\r'; // Comando OBDII para obtener RPM
    connection!.output.add(utf8.encode(command));
    print('Comando enviado: $command');
  }

  void handleData(Uint8List data) {
    String result = String.fromCharCodes(data);
    print('Datos recibidos: $result');

    // Procesar la respuesta para extraer el valor de RPM
    List<String> parts =
        result.trim().split(' '); // Separar la respuesta por espacios
    if (parts.length >= 3 && parts[0] == '41' && parts[1] == '0C') {
      // Extraer los dos bytes que contienen el valor de RPM
      int highByte =
          int.parse(parts[2], radix: 16); // Convertir de hexadecimal a decimal
      int lowByte =
          int.parse(parts[3], radix: 16); // Convertir de hexadecimal a decimal

      // Calcular RPM
      int rpm = ((highByte * 256) + lowByte) ~/
          4; // Dividir por 4, fórmula para calcular el valor del rpm
      setState(() {
        rpmData = rpm.toString(); // Actualiza la variable RPM
      });
    } else {
      setState(() {
        rpmData = 'Datos OBDII no válidos'; // Mensaje de error
      });
    }
  }

  void startSendingLocationAutomatically() {
    _timer = Timer.periodic(Duration(seconds: 10), (timer) {
      _getCurrentLocation(); // Obtener y enviar la ubicación automáticamente cada 10 segundos
    });
  }

  Future<void> _getCurrentLocation() async {
    if (!await Permission.location.isGranted) {
      setState(() {
        locationMessage =
            'Los permisos de ubicación son necesarios para esta función.';
      });
      return;
    }

    Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high);
    String formattedTimestamp =
        DateFormat('yyyy-MM-dd HH:mm:ss').format(DateTime.now());

    setState(() {
      locationMessage =
          'Latitud: ${position.latitude}\nLongitud: ${position.longitude}\nTimestamp: $formattedTimestamp\nRPM: $rpmData';
    });

    _sendToIP1(); // Enviar la ubicación a la primera IP
    _sendToIP2(); // Enviar la ubicación a la segunda IP
    _sendToIP3(); // Enviar la ubicación a la tercera IP
    _sendToIP4(); // Enviar la ubicación a la cuarta IP
  }

  Future<void> _sendToIP1() async {
    const String ip1 = '34.237.115.217';
    const int port1 = 10000;
    String message = locationMessage;

    try {
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 0)
          .then((RawDatagramSocket socket) {
        socket.send(message.codeUnits, InternetAddress(ip1), port1);
        socket.close();
      });
    } catch (e) {
      _showMessage('Error al enviar datos UDP a $ip1: $e');
    }
  }

  Future<void> _sendToIP2() async {
    const String ip2 = '52.201.28.44';
    const int port2 = 10000;
    String message = locationMessage;

    try {
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 0)
          .then((RawDatagramSocket socket) {
        socket.send(message.codeUnits, InternetAddress(ip2), port2);
        socket.close();
      });
    } catch (e) {
      _showMessage('Error al enviar datos UDP a $ip2: $e');
    }
  }

  Future<void> _sendToIP3() async {
    const String ip3 = '100.27.99.57';
    const int port3 = 10000;
    String message = locationMessage;

    try {
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 0)
          .then((RawDatagramSocket socket) {
        socket.send(message.codeUnits, InternetAddress(ip3), port3);
        socket.close();
      });
    } catch (e) {
      _showMessage('Error al enviar datos UDP a $ip3: $e');
    }
  }

  Future<void> _sendToIP4() async {
    const String ip4 = '34.226.60.112';
    const int port4 = 10000;
    String message = locationMessage;

    try {
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 0)
          .then((RawDatagramSocket socket) {
        socket.send(message.codeUnits, InternetAddress(ip4), port4);
        socket.close();
      });
    } catch (e) {
      _showMessage('Error al enviar datos UDP a $ip4: $e');
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
                locationMessage.isNotEmpty
                    ? locationMessage
                    : 'Esperando la primera actualización...',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18)),
          ],
        ),
      ),
    );
  }
}
