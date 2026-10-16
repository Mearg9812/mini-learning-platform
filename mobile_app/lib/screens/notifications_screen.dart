import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await context.read<AuthProvider>().client.get('/notifications');
      final entries = List<dynamic>.from(response.data as List);
      if (!mounted) return;
      setState(() {
        _notifications = entries
            .map((entry) => Map<String, dynamic>.from(entry as Map))
            .toList();
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load your notifications. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _markAsRead(Map<String, dynamic> notification) async {
    if (notification['isRead'] == true) return;
    final id = notification['id'] as String?;
    if (id == null) return;
    try {
      await context.read<AuthProvider>().client.patch('/notifications/$id/read');
      if (!mounted) return;
      setState(() => notification['isRead'] = true);
    } catch (_) {
      // Opening the message should still work when marking it read fails.
    }
  }

  String _dateLabel(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (date == null) return '';
    final now = DateTime.now();
    final sameDay = date.year == now.year && date.month == now.month && date.day == now.day;
    final time = '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    if (sameDay) return 'Today · $time';
    return '${date.day}/${date.month}/${date.year} · $time';
  }

  void _openNotification(Map<String, dynamic> notification) {
    _markAsRead(notification);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(notification['title'] as String? ?? 'Announcement', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(_dateLabel(notification['createdAt']), style: Theme.of(context).textTheme.labelMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
              const SizedBox(height: 18),
              Text(notification['body'] as String? ?? '', style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.55)),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications', style: TextStyle(fontWeight: FontWeight.w700))),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.wifi_off_rounded, size: 42),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(onPressed: _loadNotifications, icon: const Icon(Icons.refresh), label: const Text('Try again')),
                    ]),
                  ),
                )
              : _notifications.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(28),
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          CircleAvatar(radius: 34, backgroundColor: colors.primaryContainer, child: Icon(Icons.notifications_none_rounded, color: colors.primary, size: 32)),
                          const SizedBox(height: 16),
                          Text('You’re all caught up', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text('New announcements will appear here.', textAlign: TextAlign.center, style: TextStyle(color: colors.onSurfaceVariant)),
                        ]),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadNotifications,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                        itemCount: _notifications.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final notification = _notifications[index];
                          final isUnread = notification['isRead'] != true;
                          return Card(
                            margin: EdgeInsets.zero,
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              onTap: () => _openNotification(notification),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  CircleAvatar(
                                    backgroundColor: isUnread ? colors.primaryContainer : colors.surfaceContainerHighest,
                                    foregroundColor: isUnread ? colors.primary : colors.onSurfaceVariant,
                                    child: const Icon(Icons.campaign_outlined),
                                  ),
                                  const SizedBox(width: 13),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Expanded(child: Text(notification['title'] as String? ?? 'Announcement', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
                                      if (isUnread) Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 5, left: 8), decoration: BoxDecoration(color: colors.primary, shape: BoxShape.circle)),
                                    ]),
                                    const SizedBox(height: 4),
                                    Text(notification['body'] as String? ?? '', maxLines: 3, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant, height: 1.4)),
                                    const SizedBox(height: 8),
                                    Text(_dateLabel(notification['createdAt']), style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.onSurfaceVariant)),
                                  ])),
                                ]),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
