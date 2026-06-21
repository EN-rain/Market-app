import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/create_listing_screen.dart';
import 'screens/listing_details_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/messages_screen.dart';
import 'screens/search_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/chat_screen.dart';
import 'storage/secure_storage.dart';

const _apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

GoRouter appRouter(FlutterSecureStorage storage) {
  final tokenStore = TokenStore(storage);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: tokenStore,
    redirect: (context, state) async {
      final accessToken = tokenStore.accessTokenSync ?? await tokenStore.readAccess();
      final hasToken = accessToken != null && accessToken.isNotEmpty;
      final goingToLogin = state.matchedLocation == '/login';
      if (!hasToken && !goingToLogin) return '/login';
      if (hasToken && goingToLogin) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => LoginScreen(tokenStore: tokenStore, apiUrl: _apiUrl),
      ),
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => HomeScreen(apiUrl: _apiUrl, tokenStore: tokenStore),
          ),
          GoRoute(
            path: '/search',
            builder: (context, state) => SearchScreen(apiUrl: _apiUrl, tokenStore: tokenStore),
          ),
          GoRoute(
            path: '/sell',
            builder: (context, state) => CreateListingScreen(apiUrl: _apiUrl, tokenStore: tokenStore),
          ),
          GoRoute(
            path: '/messages',
            builder: (context, state) => MessagesScreen(apiUrl: _apiUrl, tokenStore: tokenStore),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => ProfileScreen(
              apiUrl: _apiUrl,
              tokenStore: tokenStore,
              showListingsOnOpen:
                  state.uri.queryParameters['showListings'] == '1',
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/listing/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return ListingDetailsScreen(apiUrl: _apiUrl, listingId: id, tokenStore: tokenStore);
        },
      ),
      GoRoute(
        path: '/favorites',
        builder: (context, state) => FavoritesScreen(apiUrl: _apiUrl, tokenStore: tokenStore),
      ),
      GoRoute(
        path: '/chat/:id',
        builder: (context, state) => ChatScreen(
          apiUrl: _apiUrl,
          tokenStore: tokenStore,
          conversationId: state.pathParameters['id'] ?? '',
        ),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Not found')),
      body: Center(child: Text('Route ${state.matchedLocation} not found')),
    ),
  );
}

class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = switch (location) {
      '/home' => 0,
      '/search' => 1,
      '/sell' => 2,
      '/messages' => 3,
      '/profile' => 4,
      _ => 0,
    };
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        height: 68,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        selectedIndex: index,
        onDestinationSelected: (i) {
          switch (i) {
            case 0:
              context.go('/home');
              break;
            case 1:
              context.go('/search');
              break;
            case 2:
              context.go('/sell');
              break;
            case 3:
              context.go('/messages');
              break;
            case 4:
              context.go('/profile');
              break;
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.search), selectedIcon: Icon(Icons.manage_search), label: 'Search'),
          NavigationDestination(icon: Icon(Icons.add_box_outlined), selectedIcon: Icon(Icons.add_box), label: 'Sell'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'Messages'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
