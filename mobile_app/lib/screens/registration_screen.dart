import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';

const _registrationPackages = <String, String>{
  'FULL_ACCESS': 'Full access',
  'GRADE_9': '9th grade full course',
  'GRADE_10': '10th grade full course',
  'GRADE_11': '11th grade full course',
  'GRADE_12': '12th grade full course',
  'FRESHMAN': 'Freshman full course',
};

class RegistrationScreen extends StatefulWidget {
  const RegistrationScreen({super.key});

  @override
  State<RegistrationScreen> createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends State<RegistrationScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _amountController = TextEditingController();
  final _currencyController = TextEditingController();
  final _receiptTextController = TextEditingController();
  final _imagePicker = ImagePicker();
  String _package = 'FULL_ACCESS';
  XFile? _receiptImage;
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _register() async {
    if (_passwordController.text.length < 8) {
      setState(
        () => _errorMessage = 'Use a password with at least 8 characters.',
      );
      return;
    }
    if (_passwordController.text != _confirmPasswordController.text) {
      setState(() => _errorMessage = 'The passwords do not match.');
      return;
    }
    final amount = double.tryParse(_amountController.text.trim());
    final currency = _currencyController.text.trim().toUpperCase();
    if (amount == null ||
        amount <= 0 ||
        !RegExp(r'^[A-Z]{3}$').hasMatch(currency) ||
        _receiptTextController.text.trim().isEmpty ||
        _receiptImage == null) {
      setState(
        () => _errorMessage = 'Choose what you paid for, enter the amount and currency, paste the bank SMS, and attach a receipt screenshot.',
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final image = _receiptImage!;
      final extension = image.name.toLowerCase().split('.').last;
      final mime =
          image.mimeType ??
          (extension == 'png'
              ? 'image/png'
              : extension == 'webp'
              ? 'image/webp'
              : 'image/jpeg');
      final auth = context.read<AuthProvider>();
      final uploadTicket = await auth.client.post(
        '/register/receipt-upload-url',
        data: {
          'fileName': image.name,
          'fileType': mime,
          'fileSize': await image.length(),
        },
      );
      await Dio().put<dynamic>(
        uploadTicket.data['uploadUrl'] as String,
        data: await image.readAsBytes(),
        options: Options(headers: {'Content-Type': mime}),
      );
      await context.read<AuthProvider>().register(
        name: _nameController.text,
        email: _emailController.text,
        phone: _phoneController.text,
        password: _passwordController.text,
        option: _package,
        amount: amount,
        currency: currency,
        receiptText: _receiptTextController.text,
        receiptObjectKey: uploadTicket.data['receiptObjectKey'] as String,
      );
      if (mounted) {
        Navigator.of(context).pop(
          'Your account and payment receipt are submitted. Sign in to check the review status.',
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _errorMessage = context.read<AuthProvider>().messageFrom(
            error,
            'We could not submit your enrollment. Please try again.',
          );
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _amountController.dispose();
    _currencyController.dispose();
    _receiptTextController.dispose();
    super.dispose();
  }

  Future<void> _chooseReceiptImage() async {
    final image = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (image != null && mounted) setState(() => _receiptImage = image);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Student enrollment')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(26),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Create your student account',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Include your payment details and receipt. An administrator will manually check the SMS and screenshot before granting course access.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 22),
                      if (_errorMessage != null) ...[
                        Text(
                          _errorMessage!,
                          style: TextStyle(color: colors.error),
                        ),
                        const SizedBox(height: 14),
                      ],
                      TextField(
                        controller: _nameController,
                        textCapitalization: TextCapitalization.words,
                        autofillHints: const [AutofillHints.name],
                        decoration: const InputDecoration(
                          labelText: 'Full name',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                      ),
                      const SizedBox(height: 13),
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          labelText: 'Email address',
                          prefixIcon: Icon(Icons.mail_outline),
                        ),
                      ),
                      const SizedBox(height: 13),
                      TextField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        autofillHints: const [AutofillHints.telephoneNumber],
                        decoration: const InputDecoration(
                          labelText: 'Phone (optional)',
                          prefixIcon: Icon(Icons.phone_outlined),
                        ),
                      ),
                      const SizedBox(height: 13),
                      DropdownButtonFormField<String>(
                        initialValue: _package,
                        decoration: const InputDecoration(
                          labelText: 'What did you pay for?',
                        ),
                        items: _registrationPackages.entries
                            .map(
                              (item) => DropdownMenuItem(
                                value: item.key,
                                child: Text(item.value),
                              ),
                            )
                            .toList(),
                        onChanged: _isLoading
                            ? null
                            : (value) =>
                                  setState(() => _package = value ?? _package),
                      ),
                      const SizedBox(height: 13),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _amountController,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              decoration: const InputDecoration(
                                labelText: 'Amount paid',
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          SizedBox(
                            width: 100,
                            child: TextField(
                              controller: _currencyController,
                              textCapitalization: TextCapitalization.characters,
                              maxLength: 3,
                              decoration: const InputDecoration(
                                labelText: 'Currency',
                                hintText: 'ETB',
                                counterText: '',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 13),
                      TextField(
                        controller: _receiptTextController,
                        minLines: 3,
                        maxLines: 6,
                        decoration: const InputDecoration(
                          labelText: 'Bank SMS receipt',
                          hintText: 'Paste the complete message, including its transaction or verification link',
                        ),
                      ),
                      const SizedBox(height: 13),
                      OutlinedButton.icon(
                        onPressed: _isLoading ? null : _chooseReceiptImage,
                        icon: const Icon(Icons.image_outlined),
                        label: Text(
                          _receiptImage?.name ??
                              'Attach receipt screenshot (JPG, PNG, WebP)',
                        ),
                      ),
                      const SizedBox(height: 13),
                      TextField(
                        controller: _passwordController,
                        obscureText: true,
                        autofillHints: const [AutofillHints.newPassword],
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          prefixIcon: Icon(Icons.lock_outline),
                          helperText: 'At least 8 characters',
                        ),
                      ),
                      const SizedBox(height: 13),
                      TextField(
                        controller: _confirmPasswordController,
                        obscureText: true,
                        onSubmitted: (_) => _register(),
                        decoration: const InputDecoration(
                          labelText: 'Confirm password',
                          prefixIcon: Icon(Icons.lock_reset_outlined),
                        ),
                      ),
                      const SizedBox(height: 22),
                      FilledButton(
                        onPressed: _isLoading ? null : _register,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(52),
                        ),
                        child: _isLoading
                            ? const SizedBox.square(
                                dimension: 21,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'Submit account and payment for review',
                              ),
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
