import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api/api_client.dart';
import '../storage/secure_storage.dart';
import '../widgets/cached_app_image.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.apiUrl, required this.tokenStore, required this.conversationId});
  final String apiUrl;
  final TokenStore tokenStore;
  final String conversationId;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _ctrl = TextEditingController();
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic> _otherUser = {};
  bool _loading = true;
  io.Socket? _socket;
  late final ApiClient _api = ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);

  @override
  void initState() {
    super.initState();
    _load();
    _connectSocket();
  }

  Future<void> _connectSocket() async {
    final token = await widget.tokenStore.readAccess();
    if (token == null) return;
    _socket = io.io(
      widget.apiUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );
    _socket!.onConnect((_) {
      _socket!.emit('joinConversation', {'conversationId': int.parse(widget.conversationId)});
    });
    _socket!.on('messageCreated', (payload) {
      final message = Map<String, dynamic>.from(payload as Map);
      if (message['conversationId'].toString() == widget.conversationId && mounted) {
        setState(() => _messages.add(message));
      }
    });
    _socket!.connect();
  }

  Future<void> _load() async {
    final user =
        widget.tokenStore.userSync ?? await widget.tokenStore.readUser();
    final results = await Future.wait([
      _api.messages(widget.conversationId),
      _api.conversations(),
    ]);
    if (!mounted) return;

    final rawMessages = results[0];
    final conversations = results[1];
    final conversation = conversations
        .map((e) => Map<String, dynamic>.from(e as Map))
        .where((item) => item['id'].toString() == widget.conversationId)
        .cast<Map<String, dynamic>?>()
        .firstOrNull;

    setState(() {
      _messages = rawMessages
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      _otherUser = conversation == null
          ? <String, dynamic>{}
          : _otherParticipant(conversation, user?['id']?.toString());
      _loading = false;
    });
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    _ctrl.clear();
    await _api.sendMessage(widget.conversationId, text);
    await _load();
  }

  @override
  void dispose() {
    _socket?.dispose();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            _ChatAvatar(user: _otherUser),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                _participantName(_otherUser),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) => Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8)),
                        child: Text(_messages[i]['content']?.toString() ?? ''),
                      ),
                    ),
                  ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(children: [
                Expanded(child: TextField(controller: _ctrl, decoration: const InputDecoration(hintText: 'Message', border: OutlineInputBorder()))),
                const SizedBox(width: 8),
                IconButton.filled(onPressed: _send, icon: const Icon(Icons.send)),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _otherParticipant(
    Map<String, dynamic> conversation,
    String? currentUserId,
  ) {
    final buyer =
        Map<String, dynamic>.from(conversation['buyer'] as Map? ?? {});
    final seller =
        Map<String, dynamic>.from(conversation['seller'] as Map? ?? {});
    if (currentUserId != null && buyer['id']?.toString() == currentUserId) {
      return seller;
    }
    if (currentUserId != null && seller['id']?.toString() == currentUserId) {
      return buyer;
    }
    return seller.isNotEmpty ? seller : buyer;
  }

  String _participantName(Map<String, dynamic> user) {
    final displayName = user['displayName']?.toString().trim();
    if (displayName != null && displayName.isNotEmpty) return displayName;
    final email = user['email']?.toString().trim();
    if (email != null && email.isNotEmpty) return email.split('@').first;
    return 'Chat';
  }
}

class _ChatAvatar extends StatelessWidget {
  const _ChatAvatar({required this.user});

  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context) {
    final imageUrl = user['profileImage']?.toString().trim();
    if (imageUrl != null && imageUrl.isNotEmpty) {
      return ClipOval(
        child: CachedAppImage(
          imageUrl: imageUrl,
          width: 38,
          height: 38,
          fit: BoxFit.cover,
          placeholderIcon: Icons.person,
          errorIcon: Icons.person,
          memCacheWidth: 100,
          memCacheHeight: 100,
          maxDiskCacheWidth: 200,
          maxDiskCacheHeight: 200,
        ),
      );
    }
    return CircleAvatar(
      radius: 19,
      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      foregroundColor: Theme.of(context).colorScheme.onPrimaryContainer,
      child: const Icon(Icons.person, size: 21),
    );
  }
}
