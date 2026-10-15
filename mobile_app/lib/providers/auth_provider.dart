import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Map<String, dynamic>? _user;
  bool _isReady = false;

  Map<String, dynamic>? get user => _user;
  bool get isReady => _isReady;
  bool get isSignedIn => _user != null;
  Dio get client => _api.client;

  Future<void> restoreSession() async {
    try {
      final token = await _storage.read(key: 'token');
      if (token != null) {
        final response = await _api.client.get('/profile');
        final user = Map<String, dynamic>.from(response.data as Map);
        if (user['role'] == 'USER') {
          _user = user;
        } else {
          await _storage.delete(key: 'token');
        }
      }
    } catch (_) {
      await _storage.delete(key: 'token');
      _user = null;
    } finally {
      _isReady = true;
      notifyListeners();
    }
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String option,
    required double amount,
    required String currency,
    required String receiptText,
    required String receiptObjectKey,
    String? phone,
  }) async {
    await _api.client.post(
      '/register',
      data: {
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
        'phone': phone?.trim(),
        'password': password,
        'option': option,
        'amount': amount,
        'currency': currency,
        'receiptText': receiptText.trim(),
        'receiptObjectKey': receiptObjectKey,
      },
    );
  }

  Future<void> login(String email, String password) async {
    final response = await _api.client.post(
      '/login',
      data: {'email': email.trim().toLowerCase(), 'password': password},
    );
    final user = Map<String, dynamic>.from(response.data['user'] as Map);
    if (user['role'] != 'USER') {
      throw StateError('Administrator accounts sign in through the dashboard.');
    }
    await _storage.write(key: 'token', value: response.data['token'] as String);
    _user = user;
    _isReady = true;
    notifyListeners();
  }

  Future<void> updateProfile({
    required String name,
    required String email,
    String? phone,
  }) async {
    final response = await _api.client.patch(
      '/profile',
      data: {'name': name.trim(), 'email': email.trim(), 'phone': phone?.trim()},
    );
    _user = Map<String, dynamic>.from(response.data as Map);
    notifyListeners();
  }

  Future<void> refreshProfile() async {
    final response = await _api.client.get('/profile');
    _user = Map<String, dynamic>.from(response.data as Map);
    notifyListeners();
  }

  Future<void> updateProfileImage(String? imageUrl) async {
    final response = await _api.client.patch(
      '/profile/image',
      data: {'profileImage': imageUrl},
    );
    _user = {...?_user, 'profileImage': response.data['profileImage']};
    notifyListeners();
  }

  Future<void> logout() async {
    await _storage.delete(key: 'token');
    _user = null;
    notifyListeners();
  }

  String messageFrom(Object error, String fallback) {
    if (error is DioException) {
      final serverMessage = error.response?.data is Map
          ? error.response?.data['error']
          : null;
      if (serverMessage is String && serverMessage.isNotEmpty) {
        return serverMessage;
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        return 'The learning server took too long to respond. Check that it is running and try again.';
      }
      if (error.type == DioExceptionType.connectionError) {
        final apiAddress = error.requestOptions.baseUrl;
        return 'Cannot reach the learning server at $apiAddress. On a physical phone, use your computer’s LAN IP or USB port forwarding.';
      }
    }
    if (error is StateError) return error.message;
    return fallback;
  }
}
