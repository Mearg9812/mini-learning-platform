import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart'; // NEW: Tells us if we are on the Web!

import 'dart:io';

class ApiService {
  final Dio _dio = Dio();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiService() {
    const configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
    var baseUrl = configuredBaseUrl.trim();
    if (baseUrl.isEmpty) {
      baseUrl = 'https://mini-learning-platform-60iw.onrender.com';
      if (!kIsWeb && Platform.isAndroid) {
        // Physical Android devices reach the computer through `adb reverse`.
        // Android emulators should override this with http://10.0.2.2:3000.
        baseUrl = 'https://mini-learning-platform-60iw.onrender.com';
      }
    }

    _dio.options.baseUrl = baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 12);
    _dio.options.receiveTimeout = const Duration(seconds: 20);

    // The Interceptor (Our Bouncer)
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          String? token = await _storage.read(key: 'token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
      ),
    );
  }

  Dio get client => _dio;
}
