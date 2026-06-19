import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';

class ApiClient {
  ApiClient({required String baseUrl, required TokenStore tokenStore})
      : _tokenStore = tokenStore,
        _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          sendTimeout: const Duration(seconds: 60),
          contentType: 'application/json',
          responseType: ResponseType.json,
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _tokenStore.readAccess();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (err, handler) async {
        if (err.response?.statusCode == 401) {
          await _tokenStore.clear();
        }
        handler.next(err);
      },
    ));
  }

  final Dio _dio;
  final TokenStore _tokenStore;

  Dio get dio => _dio;

  Future<Map<String, dynamic>> register(String email, String password) async {
    final res = await _dio.post('/auth/register', data: {'email': email, 'password': password});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> forgotPassword(String email) async {
    final res = await _dio.post('/auth/forgot-password', data: {'email': email});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> resetPassword(String email, String code, String password) async {
    final res = await _dio.post('/auth/reset-password', data: {'email': email, 'code': code, 'password': password});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> requestOtp(String email) async {
    final res = await _dio.post('/auth/request-otp', data: {'email': email});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> verifyOtp(String email, String code) async {
    final res = await _dio.post('/auth/verify-otp', data: {'email': email, 'code': code});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> logout() async {
    final refresh = await _tokenStore.readRefresh();
    if (refresh != null) {
      await _dio.post('/auth/logout', data: {'refreshToken': refresh});
    }
    await _tokenStore.clear();
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _dio.get('/users/me');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> updateMe(Map<String, dynamic> data) async {
    final res = await _dio.patch('/users/me', data: data);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> listListings({
    String? brand,
    String? model,
    String? q,
    String? condition,
    String? storage,
    String? location,
    int? minPrice,
    int? maxPrice,
    String sort = 'newest',
    int page = 1,
    int limit = 20,
  }) async {
    final res = await _dio.get('/listings', queryParameters: {
      if (brand != null && brand.isNotEmpty) 'brand': brand,
      if (model != null && model.isNotEmpty) 'model': model,
      if (q != null && q.isNotEmpty) 'q': q,
      if (condition != null && condition.isNotEmpty) 'condition': condition,
      if (storage != null && storage.isNotEmpty) 'storage': storage,
      if (location != null && location.isNotEmpty) 'location': location,
      if (minPrice != null) 'minPrice': minPrice,
      if (maxPrice != null) 'maxPrice': maxPrice,
      'sort': sort,
      'page': page,
      'limit': limit,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> getListing(String id) async {
    final res = await _dio.get('/listings/$id');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> listBrands() async {
    final res = await _dio.get('/brands');
    return List<dynamic>.from(res.data as List);
  }

  Future<Map<String, dynamic>> createListing({
    required String brand,
    required String model,
    required int price,
    required String condition,
    required String storage,
    required String color,
    required String location,
    required String description,
    required List<String> imagePaths,
  }) async {
    final form = FormData.fromMap({
      'brand': brand,
      'model': model,
      'price': price,
      'condition': condition,
      'storage': storage,
      'colour': color,
      'location': location,
      'description': description,
      'photos': [for (final path in imagePaths) await MultipartFile.fromFile(path)],
    });
    final res = await _dio.post('/listings', data: form);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> myListings() async => List<dynamic>.from((await _dio.get('/listings/mine')).data as List);
  Future<void> markSold(String id) async => _dio.post('/listings/$id/mark-sold');
  Future<void> removeListing(String id) async => _dio.delete('/listings/$id');
  Future<void> republish(String id) async => _dio.post('/listings/$id/republish');

  Future<List<dynamic>> favorites() async => List<dynamic>.from((await _dio.get('/favorites')).data as List);
  Future<void> addFavorite(String id) async => _dio.post('/favorites', data: {'listingId': int.parse(id)});
  Future<void> removeFavorite(String id) async => _dio.delete('/favorites/$id');

  Future<Map<String, dynamic>> startConversation(String listingId) async {
    final res = await _dio.post('/conversations', data: {'listingId': int.parse(listingId)});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> conversations() async => List<dynamic>.from((await _dio.get('/conversations')).data as List);
  Future<List<dynamic>> messages(String conversationId) async => List<dynamic>.from((await _dio.get('/conversations/$conversationId/messages')).data as List);
  Future<Map<String, dynamic>> sendMessage(String conversationId, String content) async {
    final res = await _dio.post('/conversations/$conversationId/messages', data: {'content': content});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> report(Map<String, dynamic> data) async => _dio.post('/reports', data: data);
  Future<void> blockUser(String userId) async => _dio.post('/blocks/$userId');
  Future<void> requestAccountDeletion() async => _dio.post('/users/me/delete-request');
  Future<void> registerPushToken(String token, String platform) async => _dio.post('/push-tokens', data: {'token': token, 'platform': platform});
}
