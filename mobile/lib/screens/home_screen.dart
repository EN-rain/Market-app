import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/api_client.dart';
import '../models/listing.dart';
import '../storage/listings_cache.dart';
import '../storage/secure_storage.dart';
import '../widgets/listing_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.apiUrl, required this.tokenStore});

  final String apiUrl;
  final TokenStore tokenStore;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _scrollCtrl = ScrollController();
  final List<Listing> _items = [];
  int _page = 1;
  bool _hasMore = true;
  bool _loadingFirst = true;
  bool _loadingMore = false;
  String? _error;

  late final ApiClient _api = ApiClient(
    baseUrl: widget.apiUrl,
    tokenStore: widget.tokenStore,
  );

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_handleScroll);
    _loadFirst();
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_handleScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _handleScroll() {
    if (!_scrollCtrl.hasClients) return;
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _loadFirst() async {
    if (_items.isEmpty) {
      final cached = await ListingsCache.readHomeListings();
      if (mounted && cached != null && cached.items.isNotEmpty) {
        setState(() {
          _items
            ..clear()
            ..addAll(cached.items.map(
                (e) => Listing.fromJson(Map<String, dynamic>.from(e as Map))));
          _hasMore = _items.length < cached.total;
          _page = 2;
          _loadingFirst = false;
          _error = null;
        });
      }
    }

    setState(() {
      _page = 1;
      _hasMore = true;
      _loadingFirst = _items.isEmpty;
      _error = null;
    });
    await _loadPage(1, replace: true);
    if (mounted) setState(() => _loadingFirst = false);
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    await _loadPage(_page);
  }

  Future<void> _loadPage(int page, {bool replace = false}) async {
    setState(() => _loadingMore = true);
    try {
      final res = await _api.listListings(page: page, limit: 12);
      final items = (res['items'] as List<dynamic>? ?? const [])
          .map((e) => Listing.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      final total = (res['total'] as num?)?.toInt() ?? 0;
      if (page == 1) {
        await ListingsCache.writeHomeListings(res);
      }
      if (!mounted) return;
      setState(() {
        if (replace) {
          _items
            ..clear()
            ..addAll(items);
        } else {
          _items.addAll(items);
        }
        _hasMore = _items.length < total;
        _page = page + 1;
      });
    } catch (e) {
      if (mounted && _items.isEmpty) {
        setState(() => _error = 'Failed to load listings: $e');
      }
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loadingFirst) {
      body = const Center(child: CircularProgressIndicator());
    } else if (_error != null) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 48),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _loadFirst, child: const Text('Retry')),
            ],
          ),
        ),
      );
    } else if (_items.isEmpty) {
      body =
          const Center(child: Text('No listings yet — be the first to sell!'));
    } else {
      final featured = _items.take(6).toList();
      final latest = _items.skip(featured.length).toList();
      body = RefreshIndicator(
        onRefresh: _loadFirst,
        child: CustomScrollView(
          controller: _scrollCtrl,
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Discover your next phone',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text('Fresh listings selected from the marketplace.',
                        style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 14),
                    FilledButton.tonalIcon(
                      onPressed: () => context.go('/search'),
                      icon: const Icon(Icons.search),
                      label: const Text('Search all listings'),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Text('Featured today',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 252,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  itemCount: featured.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, index) => SizedBox(
                    width: 172,
                    child: ListingCard(
                      listing: featured[index],
                      onTap: () =>
                          context.push('/listing/${featured[index].id}'),
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                child: Text('Latest listings',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.68,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    if (i >= latest.length) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    final l = latest[i];
                    return ListingCard(
                      listing: l,
                      onTap: () => context.push('/listing/${l.id}'),
                    );
                  },
                  childCount: latest.length + (_loadingMore ? 2 : 0),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: const Text('Home'),
      ),
      body: body,
    );
  }
}
