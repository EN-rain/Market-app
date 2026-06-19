import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/listing.dart';

class ListingCard extends StatelessWidget {
  const ListingCard({super.key, required this.listing, this.onTap});

  final Listing listing;
  final VoidCallback? onTap;

  static final _money = NumberFormat.currency(locale: 'en_US', symbol: 'PHP ', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: listing.primaryImageUrl != null
                  ? CachedNetworkImage(
                      imageUrl: listing.primaryImageUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: Colors.grey.shade200),
                      errorWidget: (_, __, ___) => Container(
                        color: Colors.grey.shade200,
                        child: const Icon(Icons.broken_image, size: 32, color: Colors.grey),
                      ),
                    )
                  : Container(
                      color: Colors.grey.shade200,
                      child: const Icon(Icons.phone_iphone, size: 32, color: Colors.grey),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${listing.brand} ${listing.model}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _money.format(listing.price),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${listing.storage} - ${_conditionLabel(listing.condition)}',
                    style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _conditionLabel(String value) {
    return switch (value) {
      'brand_new' => 'Brand new',
      'like_new' => 'Like new',
      'excellent' => 'Excellent',
      'good' => 'Good',
      'fair' => 'Fair',
      _ => value,
    };
  }
}
