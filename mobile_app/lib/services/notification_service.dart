import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();
  static const _channelId = 'mini_learning_announcements';
  static const _channelName = 'Learning announcements';

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  void Function()? _onNotificationTap;
  bool _initialized = false;

  Future<void> initialize({required void Function() onNotificationTap}) async {
    if (_initialized) return;
    _onNotificationTap = onNotificationTap;
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('ic_notification'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (_) => _onNotificationTap?.call(),
    );

    const channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: 'Announcements sent from Mini Learning',
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);

    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    FirebaseMessaging.onMessageOpenedApp.listen((_) => _onNotificationTap?.call());
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    final localLaunch = await _localNotifications.getNotificationAppLaunchDetails();
    if (initialMessage != null || localLaunch?.didNotificationLaunchApp == true) {
      Future<void>.delayed(
        const Duration(milliseconds: 700),
        () => _onNotificationTap?.call(),
      );
    }
    _initialized = true;
  }

  Future<void> enableForSignedInStudent() async {
    if (!_initialized) return;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        await FirebaseMessaging.instance.subscribeToTopic('all');
      }
    } catch (_) {
      // Push permission is optional; the in-app inbox remains available.
    }
  }

  Future<void> disableForSignedOutUser() async {
    if (!_initialized) return;
    try {
      await FirebaseMessaging.instance.unsubscribeFromTopic('all');
    } catch (_) {
      // Signing out must still complete when FCM is unavailable.
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    await _localNotifications.show(
      id: message.messageId?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
      title: notification.title ?? 'Mini Learning',
      body: notification.body ?? '',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: 'Announcements sent from Mini Learning',
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_notification',
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}
