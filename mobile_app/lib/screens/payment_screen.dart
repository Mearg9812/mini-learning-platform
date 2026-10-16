import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';

const _purchaseOptions = <String, String>{
  'FULL_ACCESS': 'Full access',
  'GRADE_9': '9th grade full course',
  'GRADE_10': '10th grade full course',
  'GRADE_11': '11th grade full course',
  'GRADE_12': '12th grade full course',
  'FRESHMAN': 'Freshman full course',
};

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _amount = TextEditingController();
  final _currency = TextEditingController();
  final _receiptText = TextEditingController();
  final _picker = ImagePicker();
  String _option = 'FULL_ACCESS';
  XFile? _image;
  List<dynamic> _requests = [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  @override
  void dispose() {
    _amount.dispose();
    _currency.dispose();
    _receiptText.dispose();
    super.dispose();
  }

  Future<void> _loadRequests() async {
    try {
      final response = await context.read<AuthProvider>().client.get(
        '/my/payment-requests',
      );
      if (mounted) {
        setState(() => _requests = List<dynamic>.from(response.data as List));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not load your receipt submissions.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickImage() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (file != null && mounted) setState(() => _image = file);
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amount.text.trim());
    final currency = _currency.text.trim().toUpperCase();
    if (amount == null || amount <= 0 || !RegExp(r'^[A-Z]{3}$').hasMatch(currency)) {
      setState(
        () => _error = 'Enter the amount paid and a 3-letter currency code.',
      );
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      String? receiptObjectKey;
      if (_image != null) {
        final image = _image!;
        final extension = image.name.toLowerCase().split('.').last;
        final mime = image.mimeType ?? (extension == 'png' ? 'image/png' : extension == 'webp' ? 'image/webp' : 'image/jpeg');
        final ticket = await context.read<AuthProvider>().client.post('/payment-requests/receipt-upload-url', data: {
          'fileName': image.name, 'fileType': mime, 'fileSize': await image.length(),
        });
        await Dio().put<dynamic>(ticket.data['uploadUrl'] as String, data: await image.readAsBytes(), options: Options(headers: {'Content-Type': mime}));
        receiptObjectKey = ticket.data['receiptObjectKey'] as String;
      }
      await context.read<AuthProvider>().client.post(
        '/payment-requests',
        data: {
          'option': _option,
          'amount': amount,
          'currency': currency,
          if (_receiptText.text.trim().isNotEmpty) 'receiptText': _receiptText.text.trim(),
          if (receiptObjectKey != null) 'receiptObjectKey': receiptObjectKey,
        },
      );
      _amount.clear();
      _receiptText.clear();
      if (mounted) setState(() => _image = null);
      await _loadRequests();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Receipt sent for admin review.')),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = context.read<AuthProvider>().messageFrom(
            error,
            'Could not submit your receipt. Please try again.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Course access & payments')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Send your bank receipt',
                    style: Theme.of(context).textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Enter the payment amount. The SMS and screenshot are optional, but can help the administrator review your request.',
                    style: TextStyle(color: colors.onSurfaceVariant),
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    initialValue: _option,
                    decoration: const InputDecoration(
                      labelText: 'Course/package',
                    ),
                    items: _purchaseOptions.entries
                        .map(
                          (entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setState(() => _option = value ?? _option),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _amount,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Amount paid',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 96,
                        child: TextField(
                          controller: _currency,
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
                  const SizedBox(height: 12),
                  TextField(
                    controller: _receiptText,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: 'Bank receipt text message (optional)',
                      hintText: 'Paste the full SMS you received',
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _sending ? null : _pickImage,
                    icon: const Icon(Icons.image_outlined),
                    label: Text(_image?.name ?? 'Attach receipt screenshot (optional)'),
                  ),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(
                        _error!,
                        style: TextStyle(color: colors.error),
                      ),
                    ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _sending ? null : _submit,
                      icon: _sending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_rounded),
                      label: Text(
                        _sending ? 'Sending receipt…' : 'Submit for review',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Your submissions',
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_requests.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Text('No receipts submitted yet.'),
            )
          else
            ..._requests.map((request) {
              final item = Map<String, dynamic>.from(request as Map);
              final status = item['status'] as String? ?? 'PENDING';
              return Card(
                child: ListTile(
                  leading: Icon(
                    status == 'APPROVED'
                        ? Icons.check_circle
                        : status == 'REJECTED'
                        ? Icons.cancel_outlined
                        : Icons.hourglass_top,
                    color: status == 'APPROVED'
                        ? Colors.green
                        : status == 'REJECTED'
                        ? colors.error
                        : Colors.orange,
                  ),
                  title: Text(
                    '${_purchaseOptions[item['option']] ?? item['option']} · ${item['currency']} ${item['amount']}',
                  ),
                  subtitle: Text(
                    '${status[0]}${status.substring(1).toLowerCase()}${item['adminNote'] == null ? '' : ' · ${item['adminNote']}'}',
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
