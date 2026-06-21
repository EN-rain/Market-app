import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../storage/secure_storage.dart';

enum _AuthMode { signIn, signUp, forgotPassword }

class LoginScreen extends StatefulWidget {
  const LoginScreen(
      {super.key, required this.tokenStore, required this.apiUrl});

  final TokenStore tokenStore;
  final String apiUrl;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  late final ApiClient _api =
      ApiClient(baseUrl: widget.apiUrl, tokenStore: widget.tokenStore);

  _AuthMode _mode = _AuthMode.signIn;
  bool _otpSent = false;
  bool _resetCodeSent = false;
  bool _loading = false;
  bool _rememberMe = false;
  bool _obscurePassword = true;
  bool _obscureConfirmation = true;
  bool _formReady = false;
  String? _error;
  String? _notice;

  String get _email => _emailCtrl.text.trim().toLowerCase();
  String get _password => _passwordCtrl.text;

  bool _validEmail() => _email.contains('@') && _email.contains('.');

  bool _validPassword() {
    if (_password.length < 8) {
      _error = 'Password must be at least 8 characters';
      return false;
    }
    return true;
  }

  void _setMode(_AuthMode mode) {
    setState(() {
      _mode = mode;
      _otpSent = false;
      _resetCodeSent = false;
      _error = null;
      _notice = null;
      _otpCtrl.clear();
      _confirmPasswordCtrl.clear();
      _obscurePassword = true;
      _obscureConfirmation = true;
    });
  }

  String _authError(Object error, String fallback) {
    if (error is DioException) {
      final status = error.response?.statusCode;
      final data = error.response?.data;
      final message = data is Map ? data['message'] : null;
      if (status == 409) {
        return 'An account already exists for this email. Sign in instead.';
      }
      if (status == 429) {
        return 'Too many attempts. Please wait a minute.';
      }
      if (message is List && message.isNotEmpty) {
        return message.first.toString();
      }
      if (message is String && message.isNotEmpty && status != 500) {
        return message;
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.receiveTimeout) {
        return 'Cannot reach PocketTrade. Check your connection and try again.';
      }
    }
    return fallback;
  }

  Future<void> _completeSignIn(Map<String, dynamic> res) async {
    final prefs = await SharedPreferences.getInstance();
    if (_rememberMe) {
      await prefs.setString('pockettrade.remembered_email', _email);
    } else {
      await prefs.remove('pockettrade.remembered_email');
    }
    await widget.tokenStore.setTokens(
      access: res['accessToken'] as String,
      refresh: res['refreshToken'] as String,
      user: Map<String, dynamic>.from(res['user'] as Map),
    );
    try {
      await FirebaseMessaging.instance.requestPermission();
      final pushToken = await FirebaseMessaging.instance.getToken();
      if (pushToken != null) {
        await _api.registerPushToken(pushToken, 'android');
      }
    } catch (_) {
      // Push registration must not block account access.
    }
    if (mounted) context.go('/home');
  }

  Future<void> _loadRememberedLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final remembered = prefs.getString('pockettrade.remembered_email') ?? '';
    if (!mounted || remembered.isEmpty) return;
    setState(() {
      _rememberMe = true;
      _emailCtrl.text = remembered;
    });
  }

  Future<void> _signIn() async {
    if (!_validEmail()) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    setState(() {
      _error = null;
      if (!_validPassword()) return;
      _loading = true;
    });
    if (!_loading) return;
    try {
      await _completeSignIn(await _api.login(_email, _password));
    } catch (e) {
      setState(() => _error = _authError(
            e,
            'Could not sign in. Check your email and password.',
          ));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _register() async {
    if (!_validEmail()) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    setState(() {
      _error = null;
      if (!_validPassword()) return;
      if (_password != _confirmPasswordCtrl.text) {
        _error = 'Passwords do not match';
        return;
      }
      _loading = true;
    });
    if (!_loading) return;
    try {
      final response = await _api.register(_email, _password);
      if (!mounted) return;
      setState(() {
        _otpSent = true;
        _notice = response['message'] as String?;
      });
    } catch (e) {
      setState(() => _error = _authError(
            e,
            'Could not create your account. Please try again.',
          ));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyRegistration() async {
    final code = _otpCtrl.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit verification code');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await _completeSignIn(await _api.verifyOtp(_email, code));
    } catch (e) {
      setState(() => _error = 'The verification code is invalid or expired');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendResetCode() async {
    if (!_validEmail()) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final response = await _api.forgotPassword(_email);
      if (!mounted) return;
      setState(() {
        _resetCodeSent = true;
        _notice = response['message'] as String?;
        _passwordCtrl.clear();
      });
    } catch (e) {
      setState(() => _error = 'Could not send a reset code');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resetPassword() async {
    final code = _otpCtrl.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit reset code');
      return;
    }
    setState(() {
      _error = null;
      if (!_validPassword()) return;
      if (_password != _confirmPasswordCtrl.text) {
        _error = 'Passwords do not match';
        return;
      }
      _loading = true;
    });
    if (!_loading) return;
    try {
      await _completeSignIn(await _api.resetPassword(_email, code, _password));
    } catch (e) {
      setState(() => _error =
          'Could not reset the password. Check the code and try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadRememberedLogin();
    Future<void>.delayed(const Duration(milliseconds: 850), () {
      if (mounted) setState(() => _formReady = true);
    });
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Welcome to PocketTrade',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    label: 'PocketTrade',
                    image: true,
                    child: Center(
                      child: Image.asset(
                        'assets/images/pockettrade_transparent.png',
                        width: 168,
                        height: 168,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 260),
                    switchInCurve: Curves.easeOutCubic,
                    switchOutCurve: Curves.easeInCubic,
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0, 0.05),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    ),
                    child: !_formReady
                        ? const SizedBox(
                            key: ValueKey('login-loading'),
                            height: 176,
                            child: Center(
                              child: SizedBox(
                                width: 160,
                                child: LinearProgressIndicator(
                                  borderRadius:
                                      BorderRadius.all(Radius.circular(4)),
                                ),
                              ),
                            ),
                          )
                        : Column(
                            key: const ValueKey('login-form'),
                            children: [
                              SegmentedButton<_AuthMode>(
                                segments: const [
                                  ButtonSegment(
                                      value: _AuthMode.signIn,
                                      icon: Icon(Icons.login),
                                      label: Text('Sign in')),
                                  ButtonSegment(
                                      value: _AuthMode.signUp,
                                      icon: Icon(Icons.person_add_alt),
                                      label: Text('Sign up')),
                                ],
                                selected: {
                                  _mode == _AuthMode.forgotPassword
                                      ? _AuthMode.signIn
                                      : _mode
                                },
                                onSelectionChanged:
                                    _loading ? null : (v) => _setMode(v.first),
                              ),
                              const SizedBox(height: 16),
                              AnimatedSize(
                                duration: const Duration(milliseconds: 220),
                                curve: Curves.easeOutCubic,
                                alignment: Alignment.topCenter,
                                child: AnimatedSwitcher(
                                  duration: const Duration(milliseconds: 220),
                                  switchInCurve: Curves.easeOutCubic,
                                  switchOutCurve: Curves.easeInCubic,
                                  transitionBuilder: (child, animation) =>
                                      FadeTransition(
                                    opacity: animation,
                                    child: SlideTransition(
                                      position: Tween<Offset>(
                                        begin: const Offset(0, 0.03),
                                        end: Offset.zero,
                                      ).animate(animation),
                                      child: child,
                                    ),
                                  ),
                                  child: Column(
                                    key: ValueKey(
                                        '$_mode-$_otpSent-$_resetCodeSent'),
                                    children: [
                                      _formFields(),
                                      if (_notice != null) ...[
                                        const SizedBox(height: 12),
                                        Text(
                                          _notice!,
                                          textAlign: TextAlign.center,
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(
                                            color: theme
                                                .colorScheme.onSurfaceVariant,
                                          ),
                                        ),
                                      ],
                                      if (_error != null) ...[
                                        const SizedBox(height: 12),
                                        Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: theme
                                                .colorScheme.errorContainer,
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            _error!,
                                            style: TextStyle(
                                              color: theme
                                                  .colorScheme.onErrorContainer,
                                            ),
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 16),
                                      FilledButton.icon(
                                        onPressed:
                                            _loading ? null : _primaryAction,
                                        icon: _loading
                                            ? const SizedBox(
                                                height: 18,
                                                width: 18,
                                                child:
                                                    CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                ),
                                              )
                                            : Icon(_buttonIcon),
                                        label: Text(_buttonText),
                                      ),
                                      const SizedBox(height: 6),
                                      _secondaryActions(),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _formFields() {
    final showPassword = _mode == _AuthMode.signIn ||
        (_mode == _AuthMode.signUp && !_otpSent) ||
        (_mode == _AuthMode.forgotPassword && _resetCodeSent);
    final showConfirm = (_mode == _AuthMode.signUp && !_otpSent) ||
        (_mode == _AuthMode.forgotPassword && _resetCodeSent);
    final showOtp = (_mode == _AuthMode.signUp && _otpSent) ||
        (_mode == _AuthMode.forgotPassword && _resetCodeSent);

    return Column(
      children: [
        TextField(
          controller: _emailCtrl,
          decoration: const InputDecoration(
            labelText: 'Email address',
            hintText: 'you@example.com',
            prefixIcon: Icon(Icons.alternate_email),
          ),
          keyboardType: TextInputType.emailAddress,
          enabled: !_loading && !showOtp,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.next,
        ),
        if (showOtp) ...[
          const SizedBox(height: 12),
          TextField(
            controller: _otpCtrl,
            decoration: const InputDecoration(
              labelText: '6-digit code',
              prefixIcon: Icon(Icons.pin_outlined),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
          ),
          if (_mode == _AuthMode.signUp && _otpSent) ...[
            const SizedBox(height: 8),
            Text(
              'Your code remains valid for 10 minutes.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
        if (showPassword) ...[
          const SizedBox(height: 12),
          TextField(
            controller: _passwordCtrl,
            decoration: InputDecoration(
              labelText: 'Password',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                onPressed: _loading
                    ? null
                    : () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              ),
            ),
            obscureText: _obscurePassword,
            enabled: !_loading,
            enableSuggestions: false,
            autocorrect: false,
            autofillHints: _mode == _AuthMode.signIn
                ? const [AutofillHints.password]
                : const [AutofillHints.newPassword],
            textInputAction:
                showConfirm ? TextInputAction.next : TextInputAction.done,
          ),
        ],
        if (_mode == _AuthMode.signIn) ...[
          const SizedBox(height: 4),
          CheckboxListTile(
            value: _rememberMe,
            onChanged: _loading
                ? null
                : (v) => setState(() => _rememberMe = v ?? false),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text('Remember me'),
          ),
        ],
        if (showConfirm) ...[
          const SizedBox(height: 12),
          TextField(
            controller: _confirmPasswordCtrl,
            decoration: InputDecoration(
              labelText: 'Confirm password',
              prefixIcon: const Icon(Icons.verified_user_outlined),
              suffixIcon: IconButton(
                tooltip: _obscureConfirmation
                    ? 'Show password confirmation'
                    : 'Hide password confirmation',
                onPressed: _loading
                    ? null
                    : () => setState(
                          () => _obscureConfirmation = !_obscureConfirmation,
                        ),
                icon: Icon(
                  _obscureConfirmation
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              ),
            ),
            obscureText: _obscureConfirmation,
            enabled: !_loading,
            enableSuggestions: false,
            autocorrect: false,
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.done,
          ),
        ],
      ],
    );
  }

  VoidCallback get _primaryAction {
    if (_mode == _AuthMode.signIn) return _signIn;
    if (_mode == _AuthMode.signUp) {
      return _otpSent ? _verifyRegistration : _register;
    }
    return _resetCodeSent ? _resetPassword : _sendResetCode;
  }

  IconData get _buttonIcon {
    if (_mode == _AuthMode.signIn) return Icons.arrow_forward;
    if (_mode == _AuthMode.signUp) {
      return _otpSent ? Icons.verified : Icons.person_add_alt;
    }
    return _resetCodeSent ? Icons.password : Icons.mark_email_read_outlined;
  }

  String get _buttonText {
    if (_mode == _AuthMode.signIn) return 'Sign in';
    if (_mode == _AuthMode.signUp) {
      return _otpSent ? 'Verify account' : 'Create account';
    }
    return _resetCodeSent ? 'Reset password' : 'Send reset code';
  }

  Widget _secondaryActions() {
    if (_mode == _AuthMode.signIn) {
      return TextButton(
        onPressed: _loading ? null : () => _setMode(_AuthMode.forgotPassword),
        child: const Text('Forgot password?'),
      );
    }
    return TextButton(
      onPressed: _loading ? null : () => _setMode(_AuthMode.signIn),
      child: const Text('Back to sign in'),
    );
  }
}
