import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import 'video_details_screen.dart';
import 'profile_screen.dart';
import '../providers/video_provider.dart';
import 'payment_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _hasPendingPayment = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final access = context.read<AuthProvider>().user?['accessCourses'];
      if (access is List && access.isNotEmpty) {
        context.read<VideoProvider>().fetchVideos();
      } else {
        _refreshPaymentReview();
      }
    });
  }

  Future<void> _checkEnrollmentStatus() async {
    final auth = context.read<AuthProvider>();
    try {
      await auth.refreshProfile();
      await _refreshPaymentReview();
      final access = auth.user?['accessCourses'];
      if (mounted && access is List && access.isNotEmpty) {
        await context.read<VideoProvider>().fetchVideos();
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not refresh enrollment status. Try again.')),
      );
    }
  }

  Future<void> _refreshPaymentReview() async {
    try {
      final response = await context.read<AuthProvider>().client.get('/my/payment-requests');
      final requests = List<dynamic>.from(response.data as List);
      if (mounted) setState(() => _hasPendingPayment = requests.any((request) => request['status'] == 'PENDING'));
    } catch (_) {
      // The screen can still guide students to the receipt page if history is unavailable.
    }
  }

  Widget _buildEnrollmentGate(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: colors.primaryContainer,
                    child: Icon(
                      Icons.lock_outline_rounded,
                      color: colors.primary,
                      size: 30,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    _hasPendingPayment ? 'Payment under review' : 'No course access yet',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _hasPendingPayment
                        ? 'Your bank receipt is with the administrator for manual SMS and screenshot verification. Refresh this page after it is reviewed.'
                        : 'Choose the course you paid for, send the bank SMS and a screenshot, and an administrator will review your receipt.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant, height: 1.5),
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(onPressed: () async { await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PaymentScreen())); await _refreshPaymentReview(); }, icon: const Icon(Icons.receipt_long_outlined), label: Text(_hasPendingPayment ? 'View payment request' : 'Submit payment receipt')),
                  const SizedBox(height: 10),
                  TextButton.icon(onPressed: _checkEnrollmentStatus, icon: const Icon(Icons.refresh_rounded), label: const Text('Refresh course access')),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // A quick helper to format seconds (120 -> "2:00")
  String _formatDuration(int totalSeconds) {
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final auth = context.watch<AuthProvider>();
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    final studentName = auth.user?['name'] as String? ?? 'Student';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Learning library', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            tooltip: 'Course payments',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PaymentScreen())),
            icon: const Icon(Icons.receipt_long_outlined),
          ),
          IconButton(
            tooltip: isDark ? 'Switch to light mode' : 'Switch to dark mode',
            onPressed: () => context.read<ThemeProvider>().toggle(),
            icon: Icon(isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
          ),
          IconButton(
            tooltip: 'Your profile',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            ),
            icon: const Icon(Icons.account_circle_outlined),
          ),
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => context.read<AuthProvider>().logout(),
            icon: const Icon(Icons.logout_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: (auth.user?['accessCourses'] is! List || (auth.user?['accessCourses'] as List).isEmpty)
          ? _buildEnrollmentGate(context)
          : Consumer<VideoProvider>(
        builder: (context, videoProvider, child) {
          // 1. LOADING STATE
          if (videoProvider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          // 2. ERROR STATE (Requirement: Retry functionality)
          if (videoProvider.errorMessage.isNotEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.wifi_off, size: 60, color: Colors.grey),
                  const SizedBox(height: 16),
                  Text(
                    videoProvider.errorMessage,
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () =>
                        videoProvider.fetchVideos(), // Retry button!
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          // 3. EMPTY STATE
          if (videoProvider.videos.isEmpty) {
            return Center(
              child: Text('No lessons are available yet.', style: theme.textTheme.bodyLarge),
            );
          }

          // 4. SUCCESS STATE: THE VIDEO LIST
          return RefreshIndicator(
            onRefresh: videoProvider.fetchVideos, // Pull down to refresh!
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Container(
                  margin: const EdgeInsets.only(bottom: 18),
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    gradient: LinearGradient(
                      colors: [colors.primary, colors.tertiary],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('YOUR LEARNING SPACE', style: theme.textTheme.labelMedium?.copyWith(color: Colors.white70, fontWeight: FontWeight.bold, letterSpacing: 1.1)),
                      const SizedBox(height: 10),
                      Text('Welcome, $studentName', style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 5),
                      Text('Pick up a new idea and keep moving forward.', style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.86))),
                    ],
                  ),
                ),
                Row(
                  children: [
                    Text('Explore lessons', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                    const Spacer(),
                    Text('${videoProvider.videos.length} lessons', style: theme.textTheme.bodySmall?.copyWith(color: colors.onSurfaceVariant)),
                  ],
                ),
                const SizedBox(height: 10),
                ...videoProvider.videos.map((video) => Card(
                  margin: const EdgeInsets.only(bottom: 14),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => VideoDetailsScreen(video: video)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Stack(
                          children: [
                            Image.network(
                              video.thumbnail,
                              height: 205,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                height: 205,
                                color: colors.surfaceContainerHighest,
                                child: Icon(Icons.play_lesson_outlined, size: 42, color: colors.onSurfaceVariant),
                              ),
                            ),
                            Positioned(
                              bottom: 10,
                              right: 10,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                                decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.78), borderRadius: BorderRadius.circular(8)),
                                child: Text(_formatDuration(video.duration), style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(video.category.toUpperCase(), style: theme.textTheme.labelSmall?.copyWith(color: colors.primary, fontWeight: FontWeight.w800, letterSpacing: 0.7)),
                              const SizedBox(height: 5),
                              Text(video.title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700), maxLines: 2, overflow: TextOverflow.ellipsis),
                              const SizedBox(height: 7),
                              Text(video.description, style: theme.textTheme.bodySmall?.copyWith(color: colors.onSurfaceVariant), maxLines: 2, overflow: TextOverflow.ellipsis),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                )),
              ],
            ),
          );
        },
      ),
    );
  }
}
