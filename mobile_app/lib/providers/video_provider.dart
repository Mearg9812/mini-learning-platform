import 'package:flutter/material.dart';
import 'package:dio/dio.dart';

import '../models/video.dart';
import '../api/api_service.dart';

// ChangeNotifier tells Flutter to update the screen whenever data changes (like React's useState)
class VideoProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<Video> videos = [];
  bool isLoading = false;
  String errorMessage = '';

  // Requirement: Fetch videos & handle network errors
  Future<void> fetchVideos() async {
    isLoading = true;
    errorMessage = '';
    notifyListeners(); // Tells the screen: "Start spinning the loading wheel!"

    try {
      final response = await _apiService.client.get('/videos');

      // Convert the JSON list into our Video objects
      List<dynamic> data = response.data;
      videos = data.map((json) => Video.fromJson(json)).toList();
    } on DioException {
      // Requirement: Offline and network error handling
      errorMessage = 'Network error. Please check your internet connection.';
    } catch (e) {
      errorMessage = 'Failed to load videos.';
    } finally {
      isLoading = false;
      notifyListeners(); // Tells the screen: "Stop spinning, data is here (or an error occurred)!"
    }
  }
}
