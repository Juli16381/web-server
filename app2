import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:async';
import 'dart:io';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GPS APP',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const MyHomePage(title: 'GPS APP'),
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
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    requestPermissions(); // Solicitar permisos al iniciar
    startSendingLocationAutomatically(); // Iniciar el envío automático
  }

  @override
  void dispose() {
    _timer?.cancel(); // Cancelar el timer cuando el widget se destruye
    super.dispose();
  }

  Future<void> requestPermissions() async {
    await [Permission.location].request();
  }

  Future<void> _getCurrentLocation() async {
    if (!await Permission.location.isGranted) {
      setState(() {
        locationMessage = 'Los permisos de ubicación son necesarios para esta función.';
      });
      return;
    }

    Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    String formattedTimestamp = DateFormat('yyyy-MM-dd HH:mm:ss').format(position.timestamp!.toLocal());

    setState(() {
      locationMessage = 'Latitud: ${position.latitude}\nLongitud: ${position.longitude}\nTimestamp: $formattedTimestamp';
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

  void startSendingLocationAutomatically() {
    _timer = Timer.periodic(Duration(seconds: 10), (timer) {
      _getCurrentLocation(); // Obtener y enviar la ubicación automáticamente cada 10 segundos
    });
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message))
    );
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
            Text(locationMessage.isNotEmpty ? locationMessage : 'Esperando la primera actualización...', textAlign: TextAlign.center, style: TextStyle(fontSize: 18)),
          ],
        ),
      ),
    );
  }
}
