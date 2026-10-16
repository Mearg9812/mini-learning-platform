import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import 'registration_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _showPassword = false;
  String? _errorMessage;
  String? _successMessage;

  Future<void> _login() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });
    try {
      await context.read<AuthProvider>().login(
        _phoneController.text,
        _passwordController.text,
      );
    } catch (error) {
      if (mounted) {
        setState(() {
          _errorMessage = context.read<AuthProvider>().messageFrom(
            error,
            'We could not sign you in. Check your details and try again.',
          );
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openRegistration() async {
    final message = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const RegistrationScreen()),
    );
    if (!mounted || message == null) return;
    setState(() {
      _successMessage = message;
      _errorMessage = null;
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          height: 54,
                          width: 54,
                          decoration: BoxDecoration(
                            color: colors.primaryContainer,
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Icon(Icons.auto_stories_rounded, color: colors.primary),
                        ),
                      ),
                      const SizedBox(height: 22),
                      Text('Welcome back', style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      Text(
                        'Sign in to continue learning at your own pace.',
                        style: theme.textTheme.bodyLarge?.copyWith(color: colors.onSurfaceVariant),
                      ),
                      const SizedBox(height: 24),
                      if (_errorMessage != null) ...[
                        _MessageBanner(message: _errorMessage!, isError: true),
                        const SizedBox(height: 16),
                      ],
                      if (_successMessage != null) ...[
                        _MessageBanner(message: _successMessage!, isError: false),
                        const SizedBox(height: 16),
                      ],
                      TextField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        autofillHints: const [AutofillHints.username, AutofillHints.telephoneNumber],
                        decoration: const InputDecoration(labelText: 'Phone number', prefixIcon: Icon(Icons.phone_outlined)),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _passwordController,
                        obscureText: !_showPassword,
                        autofillHints: const [AutofillHints.password],
                        onSubmitted: (_) => _login(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _showPassword ? 'Hide password' : 'Show password',
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                            icon: Icon(_showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),
                      FilledButton(
                        onPressed: _isLoading ? null : _login,
                        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                        child: _isLoading
                            ? const SizedBox.square(dimension: 21, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Sign in'),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('New to Mini Learning?', style: theme.textTheme.bodyMedium),
                          TextButton(onPressed: _isLoading ? null : _openRegistration, child: const Text('Enroll as a student')),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Free videos are available after signup. Paid courses unlock after approval.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall?.copyWith(color: colors.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MessageBanner extends StatelessWidget {
  const _MessageBanner({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? Theme.of(context).colorScheme.error : Colors.green;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(message, style: TextStyle(color: color)),
    );
  }
}
