import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

class PocketTradeImageCache {
  PocketTradeImageCache._();

  static final CacheManager manager = CacheManager(
    Config(
      'pockettrade_images_v1',
      stalePeriod: const Duration(days: 30),
      maxNrOfCacheObjects: 600,
    ),
  );

  static String key(String url) =>
      Uri.tryParse(url)?.replace(query: '').toString() ?? url;

  static ImageProvider provider(String url) {
    final normalizedUrl = url.trim();
    return CachedNetworkImageProvider(
      optimizedUrl(normalizedUrl),
      cacheKey: key(normalizedUrl),
      cacheManager: manager,
    );
  }

  static String optimizedUrl(
    String url, {
    int? width,
    int? height,
    String crop = 'fill',
  }) {
    if (!url.contains('res.cloudinary.com') || !url.contains('/upload/')) {
      return url;
    }
    final transforms = [
      if (width != null) 'w_$width',
      if (height != null) 'h_$height',
      'c_$crop',
      'q_auto',
      'f_auto',
    ].join(',');
    return url.replaceFirst('/upload/', '/upload/$transforms/');
  }
}

class CachedAppImage extends StatelessWidget {
  const CachedAppImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.placeholderIcon = Icons.phone_iphone,
    this.errorIcon = Icons.broken_image,
    this.memCacheWidth,
    this.memCacheHeight,
    this.maxDiskCacheWidth,
    this.maxDiskCacheHeight,
  });

  final String imageUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final IconData placeholderIcon;
  final IconData errorIcon;
  final int? memCacheWidth;
  final int? memCacheHeight;
  final int? maxDiskCacheWidth;
  final int? maxDiskCacheHeight;

  @override
  Widget build(BuildContext context) {
    final normalizedUrl = imageUrl.trim();
    if (normalizedUrl.isEmpty) {
      return ImageFallback(icon: placeholderIcon, width: width, height: height);
    }

    final optimizedUrl = PocketTradeImageCache.optimizedUrl(
      normalizedUrl,
      width: maxDiskCacheWidth ?? memCacheWidth,
      height: maxDiskCacheHeight ?? memCacheHeight,
    );

    return CachedNetworkImage(
      imageUrl: optimizedUrl,
      cacheKey: PocketTradeImageCache.key(normalizedUrl),
      cacheManager: PocketTradeImageCache.manager,
      fit: fit,
      width: width,
      height: height,
      fadeInDuration: Duration.zero,
      fadeOutDuration: Duration.zero,
      memCacheWidth: memCacheWidth,
      memCacheHeight: memCacheHeight,
      maxWidthDiskCache: maxDiskCacheWidth,
      maxHeightDiskCache: maxDiskCacheHeight,
      placeholder: (_, __) =>
          ImageFallback(icon: placeholderIcon, width: width, height: height),
      errorWidget: (_, __, ___) =>
          ImageFallback(icon: errorIcon, width: width, height: height),
    );
  }
}

class ImageFallback extends StatelessWidget {
  const ImageFallback({
    super.key,
    this.icon = Icons.phone_iphone,
    this.width,
    this.height,
  });

  final IconData icon;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      color: Colors.grey.shade200,
      alignment: Alignment.center,
      child: Icon(icon, size: 32, color: Colors.grey),
    );
  }
}
