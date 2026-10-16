import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';

const _packages = <String, String>{
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
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _amount = TextEditingController();
  final _currency = TextEditingController();
  final _sms = TextEditingController();
  final _picker = ImagePicker();
  String _package = 'FULL_ACCESS';
  XFile? _image;
  bool _paid = false, _loading = false;
  bool _showPassword = false, _showConfirmPassword = false;
  String? _error;

  Future<void> _register() async {
    if (_name.text.trim().length < 2 || _phone.text.trim().isEmpty) {
      setState(() => _error = 'Enter your name and phone number.'); return;
    }
    if (_password.text.length < 8) { setState(() => _error = 'Use a password with at least 8 characters.'); return; }
    if (_password.text != _confirm.text) { setState(() => _error = 'The passwords do not match.'); return; }
    final amount = double.tryParse(_amount.text.trim());
    final currency = _currency.text.trim().toUpperCase();
    if (_paid && (amount == null || amount <= 0 || !RegExp(r'^[A-Z]{3}$').hasMatch(currency))) {
      setState(() => _error = 'Enter the amount paid and a 3-letter currency code.'); return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      String? receiptKey;
      if (_paid && _image != null) {
        final image = _image!;
        final ext = image.name.toLowerCase().split('.').last;
        final mime = image.mimeType ?? (ext == 'png' ? 'image/png' : ext == 'webp' ? 'image/webp' : 'image/jpeg');
        final ticket = await context.read<AuthProvider>().client.post('/register/receipt-upload-url', data: {
          'fileName': image.name, 'fileType': mime, 'fileSize': await image.length(),
        });
        await Dio().put<dynamic>(ticket.data['uploadUrl'] as String, data: await image.readAsBytes(), options: Options(headers: {'Content-Type': mime}));
        receiptKey = ticket.data['receiptObjectKey'] as String;
      }
      await context.read<AuthProvider>().register(
        name: _name.text, phone: _phone.text, password: _password.text,
        option: _paid ? _package : null, amount: _paid ? amount : null,
        currency: _paid ? currency : null, receiptText: _paid ? _sms.text : null,
        receiptObjectKey: receiptKey,
      );
      if (mounted) Navigator.of(context).pop(_paid
        ? 'Your account and payment request are submitted. Sign in to watch free videos while it is reviewed.'
        : 'Your account is ready. Sign in to watch free videos.');
    } catch (error) {
      if (mounted) setState(() => _error = context.read<AuthProvider>().messageFrom(error, 'We could not create your account. Please try again.'));
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _pickImage() async {
    final image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 88);
    if (image != null && mounted) setState(() => _image = image);
  }

  @override
  void dispose() {
    _name.dispose(); _phone.dispose(); _password.dispose(); _confirm.dispose();
    _amount.dispose(); _currency.dispose(); _sms.dispose(); super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context); final colors = theme.colorScheme;
    return Scaffold(appBar: AppBar(title: const Text('Student registration')), body: SafeArea(child: Center(child: SingleChildScrollView(
      padding: const EdgeInsets.all(24), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 500), child: Card(child: Padding(
        padding: const EdgeInsets.all(26), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Create your student account', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text('Register with your phone number and start watching free videos. If you have already paid, you can submit the payment details now or later.', style: theme.textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant)),
          const SizedBox(height: 22),
          if (_error != null) ...[Text(_error!, style: TextStyle(color: colors.error)), const SizedBox(height: 14)],
          TextField(controller: _name, textCapitalization: TextCapitalization.words, autofillHints: const [AutofillHints.name], decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline))),
          const SizedBox(height: 13),
          TextField(controller: _phone, keyboardType: TextInputType.phone, autofillHints: const [AutofillHints.telephoneNumber], decoration: const InputDecoration(labelText: 'Phone number', prefixIcon: Icon(Icons.phone_outlined), helperText: 'Use the number you will sign in with')),
          const SizedBox(height: 8),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: _paid, onChanged: _loading ? null : (value) => setState(() => _paid = value), title: const Text('I have already paid'), subtitle: const Text('Submit payment information with registration')),
          if (_paid) ...[
            DropdownButtonFormField<String>(initialValue: _package, decoration: const InputDecoration(labelText: 'What did you pay for?'), items: _packages.entries.map((item) => DropdownMenuItem(value: item.key, child: Text(item.value))).toList(), onChanged: _loading ? null : (value) => setState(() => _package = value ?? _package)),
            const SizedBox(height: 13),
            Row(children: [Expanded(child: TextField(controller: _amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Amount paid'))), const SizedBox(width: 12), SizedBox(width: 100, child: TextField(controller: _currency, textCapitalization: TextCapitalization.characters, maxLength: 3, decoration: const InputDecoration(labelText: 'Currency', hintText: 'ETB', counterText: '')))]),
            const SizedBox(height: 13),
            TextField(controller: _sms, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: 'Bank SMS (optional)', hintText: 'Paste the transaction message if available')),
            const SizedBox(height: 13),
            OutlinedButton.icon(onPressed: _loading ? null : _pickImage, icon: const Icon(Icons.image_outlined), label: Text(_image?.name ?? 'Attach screenshot (optional)')),
          ],
          const SizedBox(height: 13),
          TextField(controller: _password, obscureText: !_showPassword, autofillHints: const [AutofillHints.newPassword], decoration: InputDecoration(labelText: 'Password', prefixIcon: const Icon(Icons.lock_outline), helperText: 'At least 8 characters', suffixIcon: IconButton(tooltip: _showPassword ? 'Hide password' : 'Show password', onPressed: () => setState(() => _showPassword = !_showPassword), icon: Icon(_showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined)))),
          const SizedBox(height: 13),
          TextField(controller: _confirm, obscureText: !_showConfirmPassword, onSubmitted: (_) => _register(), decoration: InputDecoration(labelText: 'Confirm password', prefixIcon: const Icon(Icons.lock_reset_outlined), suffixIcon: IconButton(tooltip: _showConfirmPassword ? 'Hide password' : 'Show password', onPressed: () => setState(() => _showConfirmPassword = !_showConfirmPassword), icon: Icon(_showConfirmPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined)))),
          const SizedBox(height: 22),
          FilledButton(onPressed: _loading ? null : _register, style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)), child: _loading ? const SizedBox.square(dimension: 21, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Create account')),
        ]),
      ))),
    ))));
  }
}
