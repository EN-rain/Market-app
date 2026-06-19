import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class CachedListings {
  const CachedListings({required this.items, required this.total});

  final List<dynamic> items;
  final int total;
}

class ListingsCache {
  ListingsCache._();

  static const _homeKey = 'pockettrade.home_listings.v1';

  static Future<CachedListings?> readHomeListings() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_homeKey);
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      return CachedListings(
        items: decoded['items'] is List
            ? decoded['items'] as List<dynamic>
            : const [],
        total: (decoded['total'] as num?)?.toInt() ?? 0,
      );
    } catch (_) {
      await prefs.remove(_homeKey);
      return null;
    }
  }

  static Future<void> writeHomeListings(Map<String, dynamic> response) async {
    final items = response['items'];
    if (items is! List || items.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _homeKey,
      jsonEncode({
        'items': items,
        'total': (response['total'] as num?)?.toInt() ?? items.length,
        'cachedAt': DateTime.now().toIso8601String(),
      }),
    );
  }
}
