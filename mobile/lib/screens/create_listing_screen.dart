import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_client.dart';
import '../models/brand.dart';
import '../storage/secure_storage.dart';

class CreateListingScreen extends StatefulWidget {
  const CreateListingScreen({super.key, required this.apiUrl, required this.tokenStore});
  final String apiUrl;
  final TokenStore tokenStore;

  @override
  State<CreateListingScreen> createState() => _CreateListingScreenState();
}

class _CreateListingScreenState extends State<CreateListingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _modelCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _storageCtrl = TextEditingController();
  final _colourCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();

  String? _brand;
  String _condition = 'good';
  List<XFile> _photos = [];
  List<Brand> _brands = [];
  bool _loadingBrands = true;
  bool _submitting = false;
  String? _error;

  static const _conditions = [
    _Option('brand_new', 'Brand new'),
    _Option('like_new', 'Like new'),
    _Option('excellent', 'Excellent'),
    _Option('good', 'Good'),
    _Option('fair', 'Fair'),
  ];

  @override
  void initState() {
    super.initState();
    _loadBrands();
  }

  @override
  void dispose() {
    _modelCtrl.dispose();
    _priceCtrl.dispose();
    _storageCtrl.dispose();
    _colourCtrl.dispose();
    _locationCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadBrands() async {
    try {
      final api = ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);
      final list = await api.listBrands();
      if (!mounted) return;
      setState(() {
        _brands = list.map((e) => Brand.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        _loadingBrands = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load brands: $e';
        _loadingBrands = false;
      });
    }
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    try {
      final picked = await picker.pickMultiImage(imageQuality: 80);
      if (picked.isNotEmpty) setState(() => _photos = picked.take(5).toList());
    } catch (e) {
      setState(() => _error = 'Photo picker error: $e');
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_photos.isEmpty) {
      setState(() => _error = 'Please select at least one photo');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Preview listing'),
        content: Text(
          '${_brand ?? ''} ${_modelCtrl.text.trim()}\n'
          'Price: ${_priceCtrl.text.trim()}\n'
          'Condition: ${_conditionLabel(_condition)}\n'
          'Photos: ${_photos.length}',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Edit')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Submit')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final api = ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);
      await api.createListing(
        brand: _brand!,
        model: _modelCtrl.text.trim(),
        price: int.parse(_priceCtrl.text.trim()),
        condition: _condition,
        storage: _storageCtrl.text.trim(),
        color: _colourCtrl.text.trim(),
        location: _locationCtrl.text.trim(),
        description: _descriptionCtrl.text.trim(),
        imagePaths: _photos.map((p) => p.path).toList(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Listing submitted - pending admin approval')),
      );
      context.go('/home');
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to create listing: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Sell your phone')),
      body: _loadingBrands
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Listing details',
                      style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _brand,
                      decoration: const InputDecoration(labelText: 'Brand', prefixIcon: Icon(Icons.phone_iphone)),
                      items: _brands.map((b) => DropdownMenuItem(value: b.name, child: Text(b.name))).toList(),
                      onChanged: (v) => setState(() => _brand = v),
                      validator: (v) => v == null || v.isEmpty ? 'Select a brand' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _modelCtrl,
                      decoration: const InputDecoration(labelText: 'Model', prefixIcon: Icon(Icons.smartphone)),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _priceCtrl,
                            decoration: const InputDecoration(labelText: 'Price', prefixIcon: Icon(Icons.payments_outlined)),
                            keyboardType: TextInputType.number,
                            validator: (v) {
                              final n = int.tryParse(v ?? '');
                              if (n == null || n < 1) return 'Enter a valid price';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _condition,
                            decoration: const InputDecoration(labelText: 'Condition', prefixIcon: Icon(Icons.verified_outlined)),
                            items: _conditions.map((c) => DropdownMenuItem(value: c.value, child: Text(c.label))).toList(),
                            onChanged: (v) => setState(() => _condition = v ?? 'good'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _storageCtrl,
                            decoration: const InputDecoration(labelText: 'Storage', hintText: '128GB', prefixIcon: Icon(Icons.sd_storage_outlined)),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextFormField(
                            controller: _colourCtrl,
                            decoration: const InputDecoration(labelText: 'Colour', prefixIcon: Icon(Icons.palette_outlined)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _locationCtrl,
                      decoration: const InputDecoration(labelText: 'Location', prefixIcon: Icon(Icons.place_outlined)),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _descriptionCtrl,
                      decoration: const InputDecoration(labelText: 'Description', hintText: 'Battery health, included items, issues'),
                      minLines: 3,
                      maxLines: 6,
                      validator: (v) {
                        if (v == null || v.trim().length < 10) return 'Min 10 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    _photoPicker(theme),
                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(_error!, style: TextStyle(color: theme.colorScheme.onErrorContainer)),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _submitting ? null : _submit,
                      icon: _submitting
                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.send),
                      label: const Text('Submit listing'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _photoPicker(ThemeData theme) {
    return InkWell(
      onTap: _pickPhoto,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 164,
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFD4DDDA)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: _photos.isEmpty
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add_a_photo, size: 32, color: theme.colorScheme.primary),
                    const SizedBox(height: 8),
                    const Text('Tap to select 1-5 photos'),
                  ],
                ),
              )
            : ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.all(8),
                itemCount: _photos.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) => Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.file(File(_photos[index].path), fit: BoxFit.cover, width: 132, height: 148),
                    ),
                    Positioned(
                      top: 4,
                      right: 4,
                      child: IconButton.filledTonal(
                        tooltip: 'Remove photo',
                        onPressed: () => setState(() => _photos.removeAt(index)),
                        icon: const Icon(Icons.close),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  String _conditionLabel(String value) {
    return _conditions.firstWhere((o) => o.value == value, orElse: () => const _Option('good', 'Good')).label;
  }
}

class _Option {
  const _Option(this.value, this.label);
  final String value;
  final String label;
}
