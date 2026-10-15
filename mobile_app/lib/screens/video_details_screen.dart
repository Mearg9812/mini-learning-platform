import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../models/video.dart';

class VideoDetailsScreen extends StatefulWidget {
  final Video video;

  const VideoDetailsScreen({super.key, required this.video});

  @override
  State<VideoDetailsScreen> createState() => _VideoDetailsScreenState();
}

class _VideoDetailsScreenState extends State<VideoDetailsScreen> {
  // Controllers for our two different players
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;
  YoutubePlayerController? _youtubeController;

  late final String _selectedSource;
  bool _isInitializing = true;
  String? _playerError;

  @override
  void initState() {
    super.initState();
    _selectedSource = widget.video.activeSource.toUpperCase();
    _initializePlayer();
  }

  // A tiny helper to pluck the 11-letter ID out of a YouTube URL
  String _extractYoutubeId(String url) {
    final trimmedUrl = url.trim();
    if (RegExp(r'^[\w-]{11}$').hasMatch(trimmedUrl)) return trimmedUrl;

    final uri = Uri.tryParse(trimmedUrl);
    if (uri == null) return '';

    final host = uri.host.toLowerCase();
    if (host == 'youtu.be') {
      return uri.pathSegments.isEmpty ? '' : uri.pathSegments.first;
    }
    if (host.endsWith('youtube.com')) {
      final id = uri.queryParameters['v'];
      if (id != null && id.isNotEmpty) return id;
      final segments = uri.pathSegments;
      if (segments.length >= 2 &&
          ['embed', 'shorts', 'live'].contains(segments.first)) {
        return segments[1];
      }
    }
    return '';
  }

  // This function decides WHICH player to turn on!
  Future<void> _initializePlayer() async {
    if (_selectedSource == 'YOUTUBE') {
      // --- TURN ON YOUTUBE PLAYER ---
      final videoId = _extractYoutubeId(widget.video.youtubeUrl);
      if (videoId.isEmpty) {
        if (!mounted) return;
        setState(() {
          _playerError = 'This video has an invalid YouTube link.';
          _isInitializing = false;
        });
        return;
      }
      _youtubeController = YoutubePlayerController.fromVideoId(
        videoId: videoId,
        params: const YoutubePlayerParams(
          showControls: true,
          showFullscreenButton: true,
        ),
      );
      if (mounted) setState(() => _isInitializing = false);
    } else {
      // --- TURN ON CLOUDFLARE MP4 PLAYER ---
      try {
        final uri = Uri.tryParse(widget.video.cloudflareUrl);
        if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
          throw const FormatException('Invalid video URL');
        }

        _videoPlayerController = VideoPlayerController.networkUrl(uri);
        await _videoPlayerController!.initialize();

        if (!mounted) return;
        _chewieController = ChewieController(
          videoPlayerController: _videoPlayerController!,
          autoPlay: false,
          looping: false,
          aspectRatio: _videoPlayerController!.value.aspectRatio,
          errorBuilder: (context, errorMessage) {
            return Center(
              child: Text(
                errorMessage,
                style: const TextStyle(color: Colors.white),
              ),
            );
          },
        );
        setState(() => _isInitializing = false);
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _playerError =
              'This video could not be played. Check that the video URL is a supported, directly playable file.';
          _isInitializing = false;
        });
      }
    }
  }

  // ⚠️ CRITICAL: We must turn off the video players when the user leaves the screen!
  @override
  void dispose() {
    _chewieController?.dispose();
    _videoPlayerController?.dispose();
    _youtubeController?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(widget.video.title, style: theme.textTheme.titleMedium),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // THE VIDEO PLAYER AREA
          Container(
            color: Colors.black,
            width: double.infinity,
            height: 250,
            child: _isInitializing
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  )
                : _playerError != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _playerError!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  )
                : _selectedSource == 'YOUTUBE'
                ? YoutubePlayer(controller: _youtubeController!)
                : Chewie(controller: _chewieController!),
          ),

          // THE VIDEO DETAILS AREA
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Badges
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: colors.primaryContainer,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          widget.video.category,
                          style: TextStyle(
                            color: colors.onPrimaryContainer,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: colors.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Source: $_selectedSource',
                          style: TextStyle(
                            color: colors.onSurfaceVariant,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Title
                  Text(
                    widget.video.title,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Description
                  Text(
                    'Description',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.video.description,
                    style: theme.textTheme.bodyLarge?.copyWith(height: 1.5),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
