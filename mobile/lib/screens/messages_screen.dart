import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/api_client.dart';
import '../storage/secure_storage.dart';
import '../widgets/cached_app_image.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen(
      {super.key, required this.apiUrl, required this.tokenStore});
  final String apiUrl;
  final TokenStore tokenStore;

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  List<Map<String, dynamic>> _items = [];
  String? _currentUserId;
  bool _loading = true;
  late final ApiClient _api =
      ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user =
        widget.tokenStore.userSync ?? await widget.tokenStore.readUser();
    final raw = await _api.conversations();
    if (!mounted) return;
    setState(() {
      _currentUserId = user?['id']?.toString();
      _items = raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: const Text('Messages'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? const Center(child: Text('No conversations yet'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final c = _items[i];
                      final listing =
                          Map<String, dynamic>.from(c['listing'] as Map? ?? {});
                      final other = _otherParticipant(c);
                      final messages =
                          c['messages'] as List<dynamic>? ?? const [];
                      final last = messages.isNotEmpty
                          ? Map<String, dynamic>.from(messages.first as Map)
                          : null;
                      return ListTile(
                        leading: _ConversationAvatar(user: other),
                        title: Text(
                          _participantName(other),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          last?['content']?.toString() ??
                              _listingTitle(listing),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/chat/${c['id']}'),
                      );
                    },
                  ),
                ),
    );
  }

  Map<String, dynamic> _otherParticipant(Map<String, dynamic> conversation) {
    final buyer =
        Map<String, dynamic>.from(conversation['buyer'] as Map? ?? {});
    final seller =
        Map<String, dynamic>.from(conversation['seller'] as Map? ?? {});
    if (_currentUserId != null && buyer['id']?.toString() == _currentUserId) {
      return seller;
    }
    if (_currentUserId != null && seller['id']?.toString() == _currentUserId) {
      return buyer;
    }
    return seller.isNotEmpty ? seller : buyer;
  }

  String _participantName(Map<String, dynamic> user) {
    final displayName = user['displayName']?.toString().trim();
    if (displayName != null && displayName.isNotEmpty) return displayName;
    final email = user['email']?.toString().trim();
    if (email != null && email.isNotEmpty) return email.split('@').first;
    return 'PocketTrade user';
  }

  String _listingTitle(Map<String, dynamic> listing) {
    final title = '${listing['brand'] ?? ''} ${listing['model'] ?? ''}'.trim();
    return title.isEmpty ? 'No messages yet' : title;
  }
}

class _ConversationAvatar extends StatelessWidget {
  const _ConversationAvatar({required this.user});

  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context) {
    final imageUrl = user['profileImage']?.toString().trim();
    if (imageUrl != null && imageUrl.isNotEmpty) {
      return ClipOval(
        child: CachedAppImage(
          imageUrl: imageUrl,
          width: 44,
          height: 44,
          fit: BoxFit.cover,
          placeholderIcon: Icons.person,
          errorIcon: Icons.person,
          memCacheWidth: 120,
          memCacheHeight: 120,
          maxDiskCacheWidth: 240,
          maxDiskCacheHeight: 240,
        ),
      );
    }
    return CircleAvatar(
      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      foregroundColor: Theme.of(context).colorScheme.onPrimaryContainer,
      child: const Icon(Icons.person),
    );
  }
}
