import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:async';
import 'dart:typed_data';
import 'dart:io'; 
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
  String connectionStatus = 'Conectando...'; 
  String rawData = ''; 
  Timer? _timer;
  Timer? _locationTimer;
  BluetoothConnection? connection;
  List<BluetoothDevice> devices = [];
  BluetoothDevice? deviceToConnect; 
  int _rpm = 0; 
  ValueNotifier<String> rpmNotifier = ValueNotifier<String>('Esperando datos OBDII...');

  @override
  void initState() {
    super.initState();
    requestBluetoothPermissions(); 
    startOBDConnection(); 
    startSendingLocationAutomatically(); 
  }

  @override
  void dispose() {
    _timer?.cancel();
    _locationTimer?.cancel();
    connection?.dispose();
    super.dispose();
  }

  Future<void> requestBluetoothPermissions() async {
    if (await Permission.bluetoothScan.request().isGranted &&
        await Permission.bluetoothConnect.request().isGranted) {
    } else {
      setState(() {
        connectionStatus = 'Permisos de Bluetooth no concedidos';
      });
    }
  }

  void startOBDConnection() async {
    await getPairedDevices();
  }

  Future<void> getPairedDevices() async {
    List<BluetoothDevice> pairedDevices = await FlutterBluetoothSerial.instance.getBondedDevices();

    for (var device in pairedDevices) {
      print('Dispositivo emparejado: ${device.name}, Dirección: ${device.address}');
      if (device.name != null && (device.name!.toUpperCase().contains('OBD') || device.name!.toUpperCase().contains('II'))) {
        devices.add(device);
        print('Dispositivo OBDII encontrado: ${device.name}');
        deviceToConnect = device;
        break;
      }
    }

    if (deviceToConnect != null) {
      connectToDevice();
    } else {
      print('No se encontraron dispositivos OBDII emparejados.');
      setState(() {
        connectionStatus = 'No se encontraron dispositivos OBDII emparejados';
      });
    }
  }

  void connectToDevice() async {
    if (deviceToConnect == null) {
      print('No hay dispositivo OBDII seleccionado para conectar.');
      return;
    }

    setState(() {
      connectionStatus = 'Conectando a OBDII...';
    });

    try {
      connection = await BluetoothConnection.toAddress(deviceToConnect!.address).timeout(
        const Duration(seconds: 10), 
        onTimeout: () {
          throw TimeoutException('Tiempo de espera agotado al intentar conectar con el dispositivo.');
        },
      );

      setState(() {
        connectionStatus = 'Conectado a OBDII';
      });
      print('Conectado al dispositivo: ${deviceToConnect!.name}');
      print('Comunicación serial establecida, listo para enviar y recibir datos.');

      connection!.output.add(ascii.encode("ATE0\r"));
      print("Comando ATE0 enviado para desactivar el eco.");

      await Future.delayed(const Duration(seconds: 1));

      connection!.input!.listen((Uint8List data) {
        handleData(data);
      }, onDone: () {
        print('Conexión cerrada por el dispositivo.');
        setState(() {
          connectionStatus = 'Conexión cerrada por el dispositivo';
        });
      }, onError: (error) {
        print('Error en la conexión: $error');
        setState(() {
          connectionStatus = 'Error en la conexión: $error';
        });
      });

      _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (connection != null && connection!.isConnected) {
          requestRPM();
        } else {
          timer.cancel();
        }
      });
    } catch (e) {
      print('Error al conectar: $e');
      setState(() {
        connectionStatus = 'Error al conectar: $e';
      });
    }
  }

  void requestRPM() {
    if (connection != null && connection!.isConnected) {
      String command = "01 0C";
      connection!.output.add(ascii.encode(command + '\r'));
      print('Comando RPM solicitado: $command');
    } else {
      print('Conexión no disponible para enviar comandos');
    }
  }

  void handleData(Uint8List data) {
    String response = ascii.decode(data);
    print("Datos recibidos: $response");

    setState(() {
      rawData = "Datos recibidos: $response";
    });

    RegExp regExp = RegExp(r'41 0C ([0-9A-Fa-f]{2}) ([0-9A-Fa-f]{2})');
    Iterable<RegExpMatch> matches = regExp.allMatches(response);

    if (matches.isNotEmpty) {
      for (var match in matches) {
        String A_str = match.group(1)!;
        String B_str = match.group(2)!;

        int A = int.parse(A_str, radix: 16);
        int B = int.parse(B_str, radix: 16);
        _rpm = ((A * 256) + B) ~/ 4;
        print("RPM: $_rpm");
        rpmNotifier.value = _rpm.toString();
        return;
      }
    }
  }

  void startSendingLocationAutomatically() {
    _locationTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      _getCurrentLocation(); 
    });
  }

  Future<void> _getCurrentLocation() async {
    if (!await Permission.location.isGranted) {
      setState(() {
        locationMessage = 'Los permisos de ubicación son necesarios para esta función.';
      });
      return;
    }

    Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    String formattedTimestamp = DateFormat('yyyy-MM-dd HH:mm:ss').format(DateTime.now());

    setState(() {
      locationMessage = 'Latitud: ${position.latitude}\nLongitud: ${position.longitude}\nTimestamp: $formattedTimestamp\nRPM: ${rpmNotifier.value}';
    });

    _sendToIP1();
    _sendToIP2();
    _sendToIP3();
    _sendToIP4();
  }

  Future<void> _sendToIP1() async {
    const String ip1 = '34.237.115.217';
    const int port1 = 10000;
    String message = locationMessage;

    try {
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 0).then((RawDatagramSocket socket) {
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
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 0).then((RawDatagramSocket socket) {
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
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 0).then((RawDatagramSocket socket) {
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
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 0).then((RawDatagramSocket socket) {
        socket.send(message.codeUnits, InternetAddress(ip4), port4);
        socket.close();
      });
    } catch (e) {
      _showMessage('Error al enviar datos UDP a $ip4: $e');
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
      body: SingleChildScrollView(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(locationMessage.isNotEmpty ? locationMessage : 'Esperando la primera actualización...', textAlign: TextAlign.center, style: const TextStyle(fontSize: 18)),
              const SizedBox(height: 20),
              Text(connectionStatus, style: const TextStyle(fontSize: 16)), 
              const SizedBox(height: 20),
              ValueListenableBuilder<String>(
                valueListenable: rpmNotifier,
                builder: (context, value, child) {
                  return Text('RPM: $value', style: const TextStyle(fontSize: 16));
                },
              ),
              const SizedBox(height: 20),
              Text(rawData, style: const TextStyle(fontSize: 16, color: Colors.grey)), 
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  setState(() {
                    connectionStatus = 'Reconectando...';
                    deviceToConnect = null;
                  });
                  startOBDConnection();
                },
                child: const Text('Reconectar OBDII'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
