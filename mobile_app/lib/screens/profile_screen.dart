import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _picker = ImagePicker();
  bool _isSaving = false;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user ?? const <String, dynamic>{};
    _nameController.text = user['name'] as String? ?? '';
    _phoneController.text = user['phone'] as String? ?? '';
  }

  Future<void> _saveProfile() async {
    setState(() => _isSaving = true);
    try {
      await context.read<AuthProvider>().updateProfile(
        name: _nameController.text,
        phone: _phoneController.text,
      );
      if (mounted) _showMessage('Your profile is up to date.');
    } catch (error) {
      if (mounted) {
        _showMessage(
          context.read<AuthProvider>().messageFrom(error, 'Could not save your profile.'),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _pickProfileImage() async {
    final image = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1400,
      maxHeight: 1400,
      imageQuality: 84,
    );
    if (image == null || !mounted) return;

    final bytes = await image.readAsBytes();
    final contentType = image.mimeType ?? _contentTypeFor(image.name);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].contains(contentType)) {
      _showMessage('Choose a JPG, PNG, WebP, or GIF image.', isError: true);
      return;
    }
    if (bytes.length > 5 * 1024 * 1024) {
      _showMessage('Profile images must be 5 MB or smaller.', isError: true);
      return;
    }

    setState(() => _isUploading = true);
    try {
      final auth = context.read<AuthProvider>();
      final ticket = await auth.client.post(
        '/profile/image/upload-url',
        data: {
          'fileName': image.name,
          'fileType': contentType,
          'fileSize': bytes.length,
        },
      );
      await Dio().put<void>(
        ticket.data['uploadUrl'] as String,
        data: bytes,
        options: Options(contentType: contentType),
      );
      await auth.updateProfileImage(ticket.data['profileImageUrl'] as String);
      if (mounted) _showMessage('Profile picture updated.');
    } catch (error) {
      if (mounted) {
        _showMessage(
          context.read<AuthProvider>().messageFrom(error, 'Could not upload your profile picture.'),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  String _contentTypeFor(String fileName) {
    final extension = fileName.split('.').last.toLowerCase();
    return switch (extension) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      _ => 'image/jpeg',
    };
  }

  Future<void> _logout() async {
    await context.read<AuthProvider>().logout();
    if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void _showMessage(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: isError ? Theme.of(context).colorScheme.error : null,
      ),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final user = context.watch<AuthProvider>().user ?? const <String, dynamic>{};
    final imageUrl = user['profileImage'] as String?;
    final isDarkMode = context.watch<ThemeProvider>().isDarkMode;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Your profile'),
        actions: [
          IconButton(
            tooltip: isDarkMode ? 'Switch to light mode' : 'Switch to dark mode',
            onPressed: () => context.read<ThemeProvider>().toggle(),
            icon: Icon(isDarkMode ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
          ),
          IconButton(
            tooltip: 'Sign out',
            onPressed: _logout,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          Stack(
                            children: [
                              CircleAvatar(
                                radius: 48,
                                backgroundColor: colors.primaryContainer,
                                child: ClipOval(
                                  child: imageUrl == null || imageUrl.isEmpty
                                      ? Icon(Icons.person_rounded, size: 46, color: colors.primary)
                                      : Image.network(
                                          imageUrl,
                                          width: 96,
                                          height: 96,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, _, _) => Icon(Icons.person_rounded, size: 46, color: colors.primary),
                                        ),
                                ),
                              ),
                              Positioned(
                                right: 0,
                                bottom: 0,
                                child: IconButton.filled(
                                  onPressed: _isUploading ? null : _pickProfileImage,
                                  tooltip: 'Change profile picture',
                                  icon: _isUploading
                                      ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                      : const Icon(Icons.camera_alt_outlined, size: 18),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(user['name'] as String? ?? 'Student', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text(user['phone'] as String? ?? '', style: theme.textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant)),
                          TextButton.icon(
                            onPressed: _isUploading ? null : _pickProfileImage,
                            icon: const Icon(Icons.image_outlined, size: 18),
                            label: Text(_isUploading ? 'Uploading…' : 'Update profile picture'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Personal information', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 18),
                          TextField(controller: _nameController, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline))),
                          const SizedBox(height: 14),
                          TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone number', prefixIcon: Icon(Icons.phone_outlined))),
                          const SizedBox(height: 20),
                          FilledButton.icon(
                            onPressed: _isSaving ? null : _saveProfile,
                            icon: _isSaving ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check_rounded),
                            label: Text(_isSaving ? 'Saving…' : 'Save changes'),
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
