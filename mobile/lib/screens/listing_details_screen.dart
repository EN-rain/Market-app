import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../api/api_client.dart';
import '../models/listing.dart';
import '../storage/secure_storage.dart';
import '../widgets/cached_app_image.dart';

class ListingDetailsScreen extends StatefulWidget {
  const ListingDetailsScreen({
    super.key,
    required this.apiUrl,
    required this.listingId,
    required this.tokenStore,
  });
  final String apiUrl;
  final String listingId;
  final TokenStore tokenStore;

  @override
  State<ListingDetailsScreen> createState() => _ListingDetailsScreenState();
}

class _ListingDetailsScreenState extends State<ListingDetailsScreen> {
  late final ApiClient _api =
      ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);
  Listing? _listing;
  String? _error;
  bool _loading = true;
  bool _actioning = false;
  bool _saved = false;
  bool _reported = false;
  bool _blocked = false;

  static final _money =
      NumberFormat.currency(locale: 'en_PH', symbol: '₱', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getListing(widget.listingId);
      if (!mounted) return;
      setState(() {
        _listing = Listing.fromJson(res);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load listing: $e';
        _loading = false;
      });
    }
  }

  Future<void> _toggleSaved(Listing listing) async {
    setState(() => _actioning = true);
    try {
      if (_saved) {
        await _api.removeFavorite(listing.id);
      } else {
        await _api.addFavorite(listing.id);
      }
      if (!mounted) return;
      setState(() => _saved = !_saved);
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_saved ? 'Saved to favorites' : 'Removed')));
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  Future<void> _reportListing(Listing listing) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Report listing?'),
        content:
            const Text('This sends the listing to PocketTrade moderation.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Report')),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _actioning = true);
    try {
      await _api.report({
        'reportedListingId': int.parse(listing.id),
        'reason': 'scam',
        'details': 'Reported from listing details',
      });
      if (!mounted) return;
      setState(() => _reported = true);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Report submitted')));
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  Future<void> _blockSeller(Listing listing) async {
    if (listing.seller == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Block seller?'),
        content:
            const Text('You will no longer be able to contact this seller.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Block')),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _actioning = true);
    try {
      await _api.blockUser(listing.seller!.id);
      if (!mounted) return;
      setState(() => _blocked = true);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Seller blocked')));
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Listing')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                      padding: const EdgeInsets.all(24), child: Text(_error!)))
              : _listing == null
                  ? const Center(child: Text('Listing not found'))
                  : _buildBody(_listing!),
    );
  }

  Widget _buildBody(Listing l) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (l.images.isNotEmpty)
            SizedBox(
              height: 280,
              child: PageView.builder(
                itemCount: l.images.length,
                itemBuilder: (context, i) => CachedAppImage(
                  imageUrl: l.images[i].url,
                  fit: BoxFit.cover,
                  height: 280,
                  memCacheWidth: 900,
                  maxDiskCacheWidth: 1400,
                ),
              ),
            )
          else
            Container(
              height: 280,
              color: Colors.grey.shade200,
              child:
                  const Icon(Icons.phone_iphone, size: 80, color: Colors.grey),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${l.brand} ${l.model}',
                    style: Theme.of(context).textTheme.headlineSmall),
                if (l.status == 'sold') ...[
                  const SizedBox(height: 8),
                  const Chip(label: Text('Sold')),
                ],
                const SizedBox(height: 8),
                Text(_money.format(l.price),
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.primary,
                    )),
                const Divider(height: 24),
                _spec('Storage', l.storage),
                _spec('Condition', l.condition),
                if (l.color.isNotEmpty) _spec('Colour', l.color),
                _spec('Location', l.location),
                _spec('Posted', DateFormat.yMMMd().format(l.createdAt)),
                const SizedBox(height: 16),
                const Text('Description',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(l.description),
                if (l.seller != null) ...[
                  const Divider(height: 32),
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundImage:
                            (l.seller!.profileImage?.isNotEmpty ?? false)
                                ? PocketTradeImageCache.provider(
                                    l.seller!.profileImage!)
                                : null,
                        child: (l.seller!.profileImage?.isNotEmpty ?? false)
                            ? null
                            : const Icon(Icons.person),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l.seller!.displayName ?? 'Seller',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                            if (l.seller!.location?.isNotEmpty ?? false)
                              Text(l.seller!.location!,
                                  style: const TextStyle(color: Colors.grey)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _actioning
                            ? null
                            : () async {
                                setState(() => _actioning = true);
                                final conversation =
                                    await _api.startConversation(l.id);
                                if (!mounted) return;
                                setState(() => _actioning = false);
                                context.push('/chat/${conversation['id']}');
                              },
                        icon: const Icon(Icons.chat_bubble_outline),
                        label: const Text('Message Seller'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                      tooltip: _saved ? 'Remove from favorites' : 'Save',
                      style: _saved
                          ? IconButton.styleFrom(
                              backgroundColor:
                                  Theme.of(context).colorScheme.primary,
                              foregroundColor:
                                  Theme.of(context).colorScheme.onPrimary)
                          : null,
                      onPressed: _actioning ? null : () => _toggleSaved(l),
                      icon: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 180),
                        child: Icon(
                          _saved ? Icons.favorite : Icons.favorite_outline,
                          key: ValueKey(_saved),
                        ),
                      ),
                    ),
                    IconButton.filledTonal(
                      tooltip: _reported ? 'Report submitted' : 'Report',
                      style: _reported
                          ? IconButton.styleFrom(
                              backgroundColor: Theme.of(context)
                                  .colorScheme
                                  .secondaryContainer,
                              foregroundColor: Theme.of(context)
                                  .colorScheme
                                  .onSecondaryContainer)
                          : null,
                      onPressed: _actioning || _reported
                          ? null
                          : () => _reportListing(l),
                      icon: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 180),
                        child: Icon(
                          _reported ? Icons.flag : Icons.flag_outlined,
                          key: ValueKey(_reported),
                        ),
                      ),
                    ),
                    if (l.seller != null)
                      IconButton.filledTonal(
                        tooltip: _blocked ? 'Seller blocked' : 'Block seller',
                        style: _blocked
                            ? IconButton.styleFrom(
                                backgroundColor: Theme.of(context)
                                    .colorScheme
                                    .errorContainer,
                                foregroundColor: Theme.of(context)
                                    .colorScheme
                                    .onErrorContainer)
                            : null,
                        onPressed: _actioning || _blocked
                            ? null
                            : () => _blockSeller(l),
                        icon: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 180),
                          child: Icon(
                            _blocked ? Icons.block : Icons.block_outlined,
                            key: ValueKey(_blocked),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _spec(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: const TextStyle(color: Colors.grey)),
          ),
          Expanded(
              child: Text(value,
                  style: const TextStyle(fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }
}
