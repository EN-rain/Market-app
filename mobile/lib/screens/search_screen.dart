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
  final _brandCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _storageCtrl = TextEditingController();
  final _minPriceCtrl = TextEditingController();
  final _maxPriceCtrl = TextEditingController();

  String _sort = 'newest';
  String _condition = 'any';
  List<Listing> _items = [];
  bool _loading = false;
  bool _loadingMore = false;
  int _page = 1;
  int _pages = 1;
  String? _error;

  late final ApiClient _api =
      ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);

  static const _conditions = [
    _Option('any', 'Any condition'),
    _Option('brand_new', 'Brand new'),
    _Option('like_new', 'Like new'),
    _Option('excellent', 'Excellent'),
    _Option('good', 'Good'),
    _Option('fair', 'Fair'),
  ];

  static const _sorts = [
    _Option('newest', 'Newest first'),
    _Option('relevant', 'Most relevant'),
    _Option('price_asc', 'Lowest price'),
    _Option('price_desc', 'Highest price'),
    _Option('oldest', 'Oldest first'),
  ];

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
        brand: _brandCtrl.text.trim(),
        location: _locationCtrl.text.trim(),
        storage: _storageCtrl.text.trim(),
        minPrice: int.tryParse(_minPriceCtrl.text.trim()),
        maxPrice: int.tryParse(_maxPriceCtrl.text.trim()),
        condition: _condition == 'any' ? null : _condition,
        sort: _sort,
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

  void _clearFilters() {
    setState(() {
      _brandCtrl.clear();
      _locationCtrl.clear();
      _storageCtrl.clear();
      _minPriceCtrl.clear();
      _maxPriceCtrl.clear();
      _condition = 'any';
      _sort = 'newest';
    });
    _search(reset: true);
  }

  Future<void> _openFilters() {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheetContext).height * 0.86,
          child: _filterDrawer(sheetContext),
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _search(reset: true);
  }

  @override
  void dispose() {
    _qCtrl.dispose();
    _brandCtrl.dispose();
    _locationCtrl.dispose();
    _storageCtrl.dispose();
    _minPriceCtrl.dispose();
    _maxPriceCtrl.dispose();
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
                child: Center(child: Text('No phones matched your filters.')),
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
        Row(
          children: [
            Expanded(child: _queryField()),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              tooltip: 'Filters',
              onPressed: _openFilters,
              icon: const Icon(Icons.tune),
            ),
          ],
        ),
        if (_activeFilterCount > 0) ...[
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: InputChip(
              avatar: const Icon(Icons.filter_alt, size: 18),
              label: Text(
                  '$_activeFilterCount filter${_activeFilterCount == 1 ? '' : 's'} active'),
              onDeleted: _loading ? null : _clearFilters,
            ),
          ),
        ],
      ],
    );
  }

  Widget _filterDrawer(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Filters',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
            ),
            IconButton(
              tooltip: 'Close',
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _filterFields(),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _loading
              ? null
              : () {
                  Navigator.of(context).maybePop();
                  _search();
                },
          icon: const Icon(Icons.search),
          label: const Text('Apply filters'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _loading
              ? null
              : () {
                  Navigator.of(context).maybePop();
                  _clearFilters();
                },
          icon: const Icon(Icons.filter_alt_off_outlined),
          label: const Text('Clear all'),
        ),
      ],
    );
  }

  Widget _filterFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _field(_brandCtrl, 'Brand', Icons.phone_iphone),
        const SizedBox(height: 12),
        _field(_locationCtrl, 'Location', Icons.place_outlined),
        const SizedBox(height: 10),
        _field(_storageCtrl, 'Storage', Icons.sd_storage_outlined),
        const SizedBox(height: 10),
        _field(_minPriceCtrl, 'Min price', Icons.payments_outlined,
            number: true),
        const SizedBox(height: 10),
        _field(_maxPriceCtrl, 'Max price', Icons.price_change_outlined,
            number: true),
        const SizedBox(height: 10),
        _compactDropdown(
          label: 'Condition',
          icon: Icons.verified_outlined,
          value: _condition,
          options: _conditions,
          onSelected: (value) => setState(() => _condition = value),
        ),
        const SizedBox(height: 10),
        _compactDropdown(
          label: 'Sort',
          icon: Icons.sort,
          value: _sort,
          options: _sorts,
          onSelected: (value) => setState(() => _sort = value),
        ),
      ],
    );
  }

  Widget _compactDropdown({
    required String label,
    required IconData icon,
    required String value,
    required List<_Option> options,
    required ValueChanged<String> onSelected,
  }) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      menuMaxHeight: 280,
      borderRadius: BorderRadius.circular(8),
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
      items: options
          .map((option) => DropdownMenuItem(
                value: option.value,
                child: Text(option.label,
                    maxLines: 1, overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: (selected) {
        if (selected != null) onSelected(selected);
      },
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

  Widget _field(TextEditingController controller, String label, IconData icon,
      {bool number = false}) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
      keyboardType: number ? TextInputType.number : TextInputType.text,
      textInputAction: TextInputAction.next,
      onChanged: (_) => setState(() {}),
    );
  }

  int get _activeFilterCount {
    var count = 0;
    if (_brandCtrl.text.trim().isNotEmpty) count++;
    if (_locationCtrl.text.trim().isNotEmpty) count++;
    if (_storageCtrl.text.trim().isNotEmpty) count++;
    if (_minPriceCtrl.text.trim().isNotEmpty) count++;
    if (_maxPriceCtrl.text.trim().isNotEmpty) count++;
    if (_condition != 'any') count++;
    if (_sort != 'newest') count++;
    return count;
  }
}

class _Option {
  const _Option(this.value, this.label);
  final String value;
  final String label;
}
