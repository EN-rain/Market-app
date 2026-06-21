import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_client.dart';
import '../models/app_user.dart';
import '../storage/secure_storage.dart';
import '../widgets/cached_app_image.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.apiUrl,
    required this.tokenStore,
    this.showListingsOnOpen = false,
  });

  final String apiUrl;
  final TokenStore tokenStore;
  final bool showListingsOnOpen;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  AppUser? _user;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  late final ApiClient _api =
      ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.showListingsOnOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showMyListings();
      });
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.getMe();
      if (!mounted) return;
      setState(() {
        _user = AppUser.fromJson(res);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Could not load your profile. Check your connection and try again.';
        _loading = false;
      });
    }
  }

  Future<void> _logout() async {
    setState(() => _busy = true);
    await _api.logout();
    if (!mounted) return;
    context.go('/login');
  }

  Future<void> _showMyListings() async {
    setState(() => _busy = true);
    try {
      final raw = await _api.myListings();
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (_) => SafeArea(
          child: DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.72,
            minChildSize: 0.35,
            maxChildSize: 0.92,
            builder: (context, controller) {
              if (raw.isEmpty) {
                return _EmptyListings(onCreate: () {
                  Navigator.pop(context);
                  this.context.go('/sell');
                });
              }
              return ListView.separated(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                itemCount: raw.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final m = Map<String, dynamic>.from(raw[index] as Map);
                  final id = m['id'].toString();
                  final title =
                      '${m['brand'] ?? ''} ${m['model'] ?? ''}'.trim();
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(vertical: 6),
                    title: Text(
                      title.isEmpty ? 'Listing' : title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(_statusLabel(m['status']?.toString())),
                    trailing: PopupMenuButton<String>(
                      tooltip: 'Listing actions',
                      onSelected: (v) async {
                        if (v == 'sold') await _api.markSold(id);
                        if (v == 'remove') await _api.removeListing(id);
                        if (v == 'republish') await _api.republish(id);
                        if (mounted) Navigator.of(this.context).pop();
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(value: 'sold', child: Text('Mark sold')),
                        PopupMenuItem(
                            value: 'republish', child: Text('Republish')),
                        PopupMenuItem(value: 'remove', child: Text('Remove')),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editProfile() async {
    final nameCtrl = TextEditingController(text: _user?.displayName ?? '');
    final locationCtrl = TextEditingController(text: _user?.location ?? '');
    XFile? pickedImage;
    var saving = false;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) {
          final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
          final imageUrl = _user?.profileImage?.trim();
          return SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 0, 20, bottomInset + 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Edit profile',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 18),
                  Center(
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CircleAvatar(
                          radius: 44,
                          backgroundColor:
                              Theme.of(context).colorScheme.primaryContainer,
                          backgroundImage: pickedImage != null
                              ? FileImage(File(pickedImage!.path))
                              : imageUrl != null && imageUrl.isNotEmpty
                                  ? PocketTradeImageCache.provider(imageUrl)
                                  : null,
                          child: pickedImage == null &&
                                  (imageUrl == null || imageUrl.isEmpty)
                              ? const Icon(Icons.person, size: 42)
                              : null,
                        ),
                        Positioned(
                          right: -6,
                          bottom: -6,
                          child: IconButton.filled(
                            tooltip: 'Change profile photo',
                            onPressed: saving
                                ? null
                                : () async {
                                    final image = await ImagePicker().pickImage(
                                      source: ImageSource.gallery,
                                      imageQuality: 82,
                                      maxWidth: 1200,
                                    );
                                    if (image != null) {
                                      final bytes =
                                          await File(image.path).length();
                                      if (bytes > 1 * 1024 * 1024) {
                                        if (mounted) {
                                          ScaffoldMessenger.of(this.context)
                                              .showSnackBar(const SnackBar(
                                            content: Text(
                                                'Profile photo must be 1 MB or smaller'),
                                          ));
                                        }
                                        return;
                                      }
                                      setSheetState(() => pickedImage = image);
                                    }
                                  },
                            icon: const Icon(Icons.photo_camera_outlined),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: locationCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Location',
                      prefixIcon: Icon(Icons.place_outlined),
                    ),
                    textInputAction: TextInputAction.done,
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: saving
                        ? null
                        : () async {
                            final precise = await _readPreciseLocation();
                            if (precise != null) {
                              locationCtrl.text = precise;
                              setSheetState(() {});
                            }
                          },
                    icon: const Icon(Icons.my_location),
                    label: const Text('Use GPS precise location'),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: saving
                              ? null
                              : () => Navigator.pop(sheetContext, false),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: saving
                              ? null
                              : () async {
                                  setSheetState(() => saving = true);
                                  try {
                                    if (pickedImage != null) {
                                      await _api.uploadProfileImage(
                                        pickedImage!.path,
                                      );
                                    }
                                    await _api.updateMe({
                                      'displayName': nameCtrl.text.trim(),
                                      'location': locationCtrl.text.trim(),
                                    });
                                    if (mounted) {
                                      Navigator.of(this.context).pop(true);
                                    }
                                  } catch (_) {
                                    setSheetState(() => saving = false);
                                    if (mounted) {
                                      ScaffoldMessenger.of(this.context)
                                          .showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'Could not save profile changes',
                                          ),
                                        ),
                                      );
                                    }
                                  }
                                },
                          child: saving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Save'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    if (saved == true) {
      await _load();
    }
  }

  Future<String?> _readPreciseLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (!mounted) return null;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Turn on location services first')),
        );
        return null;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (!mounted) return null;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location permission was not granted')),
        );
        return null;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      return '${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}';
    } catch (_) {
      if (!mounted) return null;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not read GPS location')),
      );
      return null;
    }
  }

  Future<void> _editNotificationPreferences() async {
    var messages = true;
    var listingUpdates = true;
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Notification preferences'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                value: messages,
                onChanged: (v) => setDialogState(() => messages = v),
                title: const Text('Messages'),
                secondary: const Icon(Icons.chat_bubble_outline),
              ),
              SwitchListTile(
                value: listingUpdates,
                onChanged: (v) => setDialogState(() => listingUpdates = v),
                title: const Text('Listing updates'),
                secondary: const Icon(Icons.inventory_2_outlined),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (saved == true) {
      await _api.updateMe({
        'notificationPreferences': {
          'messages': messages,
          'listingUpdates': listingUpdates,
        },
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Preferences saved')),
      );
    }
  }

  Future<void> _showTerms() async {
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Terms and privacy'),
        content: const Text(
          'Use PocketTrade for lawful used-phone listings. Keep communication respectful, report scams, and do not share sensitive personal information in public listing fields. Account data is used for login, listings, messages, moderation, and safety features.',
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _requestDeletion() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Request account deletion'),
        content: const Text(
          'Your account will be marked for deletion review. You can still use PocketTrade while the request is reviewed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Request'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _api.requestAccountDeletion();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Deletion request submitted')),
      );
    }
  }

  Future<void> _changePassword() async {
    final currentCtrl = TextEditingController();
    final nextCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    var saving = false;
    String? error;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) {
          final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
          return SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 0, 20, bottomInset + 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Change password',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: currentCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Current password',
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                    obscureText: true,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: nextCtrl,
                    decoration: const InputDecoration(
                      labelText: 'New password',
                      prefixIcon: Icon(Icons.password),
                    ),
                    obscureText: true,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: confirmCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Confirm new password',
                      prefixIcon: Icon(Icons.verified_user_outlined),
                    ),
                    obscureText: true,
                    textInputAction: TextInputAction.done,
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      error!,
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed:
                              saving ? null : () => Navigator.pop(sheetContext),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: saving
                              ? null
                              : () async {
                                  final next = nextCtrl.text;
                                  if (next.length < 8) {
                                    setSheetState(() => error =
                                        'New password must be at least 8 characters');
                                    return;
                                  }
                                  if (next != confirmCtrl.text) {
                                    setSheetState(() =>
                                        error = 'New passwords do not match');
                                    return;
                                  }
                                  setSheetState(() {
                                    saving = true;
                                    error = null;
                                  });
                                  try {
                                    await _api.changePassword(
                                      currentCtrl.text,
                                      next,
                                    );
                                    if (!mounted) return;
                                    Navigator.of(this.context).pop();
                                    ScaffoldMessenger.of(this.context)
                                        .showSnackBar(
                                      const SnackBar(
                                        content: Text('Password changed'),
                                      ),
                                    );
                                  } catch (_) {
                                    setSheetState(() {
                                      saving = false;
                                      error = 'Could not change password';
                                    });
                                  }
                                },
                          child: saving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Save'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: const Text('Profile'),
      ),
      body: _loading
          ? const _ProfileLoading()
          : _error != null
              ? _ProfileError(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      _ProfileHeader(user: _user),
                      const SizedBox(height: 16),
                      _Section(
                        title: 'Marketplace',
                        children: [
                          _ActionRow(
                            icon: Icons.favorite_outline,
                            title: 'Saved listings',
                            subtitle: 'Phones you are tracking',
                            onTap: () => context.push('/favorites'),
                          ),
                          _ActionRow(
                            icon: Icons.inventory_2_outlined,
                            title: 'My listings',
                            subtitle: 'Manage active, sold, and removed posts',
                            onTap: _busy ? null : _showMyListings,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _Section(
                        title: 'Account',
                        children: [
                          _ActionRow(
                            icon: Icons.edit_outlined,
                            title: 'Edit profile',
                            subtitle: 'Display name and location',
                            onTap: _editProfile,
                          ),
                          _ActionRow(
                            icon: Icons.notifications_outlined,
                            title: 'Notifications',
                            subtitle: 'Messages and listing updates',
                            onTap: _editNotificationPreferences,
                          ),
                          _ActionRow(
                            icon: Icons.description_outlined,
                            title: 'Terms and privacy',
                            subtitle: 'Safety, data, and marketplace rules',
                            onTap: _showTerms,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _Section(
                        title: 'Security',
                        children: [
                          _ActionRow(
                            icon: Icons.password,
                            title: 'Change password',
                            subtitle: 'Update your account password',
                            onTap: _changePassword,
                          ),
                          _ActionRow(
                            icon: Icons.delete_outline,
                            title: 'Request account deletion',
                            subtitle: 'Submit your account for review',
                            isDestructive: true,
                            onTap: _requestDeletion,
                          ),
                          _ActionRow(
                            icon: Icons.logout,
                            title: 'Log out',
                            subtitle: 'Sign out on this device',
                            onTap: _busy ? null : _logout,
                          ),
                        ],
                      ),
                      if (_busy) ...[
                        const SizedBox(height: 16),
                        Center(
                          child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }

  String _statusLabel(String? value) {
    return switch (value) {
      'pending' => 'Pending approval',
      'approved' || 'active' => 'Approved',
      'rejected' => 'Rejected',
      'sold' => 'Marked sold',
      'removed' => 'Removed listing',
      null || '' => 'Listing',
      _ => value,
    };
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.user});

  final AppUser? user;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final displayName = user?.displayName?.trim();
    final name = displayName == null || displayName.isEmpty
        ? 'PocketTrade user'
        : displayName;
    final location = user?.location?.trim();
    final imageUrl = user?.profileImage?.trim();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      child: Row(
        children: [
          Semantics(
            label: 'Profile photo',
            image: true,
            child: CircleAvatar(
              radius: 34,
              backgroundColor: theme.colorScheme.primaryContainer,
              foregroundColor: theme.colorScheme.onPrimaryContainer,
              backgroundImage: imageUrl != null && imageUrl.isNotEmpty
                  ? PocketTradeImageCache.provider(imageUrl)
                  : null,
              child: imageUrl == null || imageUrl.isEmpty
                  ? const Icon(Icons.person, size: 34)
                  : null,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user?.email ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                if (location != null && location.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        size: 16,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          location,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title,
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Column(children: children),
      ],
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.isDestructive = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color =
        isDestructive ? theme.colorScheme.error : theme.colorScheme.primary;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileLoading extends StatelessWidget {
  const _ProfileLoading();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Container(
          height: 104,
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        const SizedBox(height: 16),
        for (var i = 0; i < 3; i += 1) ...[
          Container(
            height: 152,
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ],
    );
  }
}

class _ProfileError extends StatelessWidget {
  const _ProfileError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.cloud_off_outlined,
              size: 42,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyListings extends StatelessWidget {
  const _EmptyListings({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inventory_2_outlined, size: 42),
            const SizedBox(height: 12),
            Text(
              'No listings yet',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            const Text(
              'Create your first phone listing when you are ready to sell.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onCreate,
              icon: const Icon(Icons.add),
              label: const Text('Create listing'),
            ),
          ],
        ),
      ),
    );
  }
}
