import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/api_client.dart';
import '../models/listing.dart';
import '../storage/secure_storage.dart';
import '../widgets/listing_card.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen(
      {super.key, required this.apiUrl, required this.tokenStore});
  final String apiUrl;
  final TokenStore tokenStore;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _qCtrl = TextEditingController();
  List<Listing> _items = [];
  bool _loading = false;
  bool _loadingMore = false;
  int _page = 1;
  int _pages = 1;
  String? _error;

  late final ApiClient _api =
      ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);

  Future<void> _search({bool reset = true}) async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (reset) {
      _page = 1;
    } else if (_loading || _loadingMore || _page >= _pages) {
      return;
    }

    setState(() {
      if (reset) {
        _loading = true;
      } else {
        _loadingMore = true;
      }
      _error = null;
    });
    try {
      final nextPage = reset ? 1 : _page + 1;
      final res = await _api.listListings(
        q: _qCtrl.text.trim(),
        page: nextPage,
        limit: 20,
      );
      final items = (res['items'] as List<dynamic>? ?? const [])
          .map((e) => Listing.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      if (!mounted) return;
      setState(() {
        _page = (res['page'] as num?)?.toInt() ?? nextPage;
        _pages = (res['pages'] as num?)?.toInt() ?? _page;
        _items = reset ? items : [..._items, ...items];
      });
    } catch (e) {
      if (mounted) {
        setState(() =>
            _error = 'Search failed. Check your connection and try again.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _search(reset: true);
  }

  @override
  void dispose() {
    _qCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: RefreshIndicator(
        onRefresh: () => _search(reset: true),
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              sliver: SliverToBoxAdapter(child: _searchBar()),
            ),
            if (_loading)
              const SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              SliverFillRemaining(
                  child:
                      Center(child: Text(_error!, textAlign: TextAlign.center)))
            else if (_items.isEmpty)
              const SliverFillRemaining(
                child: Center(child: Text('No phones matched your search.')),
              )
            else ...[
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                sliver: SliverLayoutBuilder(
                  builder: (context, constraints) {
                    final width = constraints.crossAxisExtent;
                    final columns = width >= 680 ? 3 : 2;
                    return SliverGrid(
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        childAspectRatio: 0.68,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, i) => ListingCard(
                          listing: _items[i],
                          onTap: () => context.push('/listing/${_items[i].id}'),
                        ),
                        childCount: _items.length,
                      ),
                    );
                  },
                ),
              ),
              if (_page < _pages)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                  sliver: SliverToBoxAdapter(
                    child: FilledButton.icon(
                      onPressed:
                          _loadingMore ? null : () => _search(reset: false),
                      icon: _loadingMore
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.expand_more),
                      label: Text(_loadingMore ? 'Loading...' : 'Load more'),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _searchBar() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _queryField(),
      ],
    );
  }

  Widget _queryField() {
    return TextField(
      controller: _qCtrl,
      decoration: InputDecoration(
        labelText: 'Search phones',
        hintText: 'iPhone 14, Pixel, 128GB',
        prefixIcon: const Icon(Icons.search),
        suffixIcon: _qCtrl.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Clear search',
                onPressed: () {
                  setState(_qCtrl.clear);
                  _search();
                },
                icon: const Icon(Icons.close),
              ),
      ),
      textInputAction: TextInputAction.search,
      onChanged: (_) => setState(() {}),
      onSubmitted: (_) => _search(),
    );
  }
}
