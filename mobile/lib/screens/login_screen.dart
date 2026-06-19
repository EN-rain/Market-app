import 'package:firebase_messaging/firebase_messaging.dart';
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
  String? _error;

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
      _otpCtrl.clear();
      _confirmPasswordCtrl.clear();
    });
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
      setState(
          () => _error = 'Could not sign in. Check your email and password.');
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
      await _api.register(_email, _password);
      if (!mounted) return;
      setState(() {
        _otpSent = true;
        _otpCtrl.clear();
      });
    } catch (e) {
      setState(() => _error =
          'Could not create that account. The email may already be registered.');
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
      await _api.forgotPassword(_email);
      if (!mounted) return;
      setState(() {
        _resetCodeSent = true;
        _otpCtrl.clear();
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
    final title = switch (_mode) {
      _AuthMode.signIn => 'Sign in to PocketTrade',
      _AuthMode.signUp =>
        _otpSent ? 'Verify your account' : 'Create your account',
      _AuthMode.forgotPassword =>
        _resetCodeSent ? 'Reset password' : 'Forgot password',
    };
    final subtitle = switch (_mode) {
      _AuthMode.signIn => 'Buy and sell phones with verified accounts.',
      _AuthMode.signUp => _otpSent
          ? 'Enter the code sent after registration.'
          : 'Your display name is created from your email.',
      _AuthMode.forgotPassword => _resetCodeSent
          ? 'Enter the reset code and a new password.'
          : 'Send a reset code to your email.',
    };

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.phone_android_rounded,
                            color: theme.colorScheme.onPrimary, size: 34),
                        const SizedBox(height: 18),
                        Text(
                          title,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: theme.colorScheme.onPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          subtitle,
                          style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onPrimary
                                  .withValues(alpha: 0.84)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
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
                  _formFields(),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.errorContainer,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(_error!,
                          style: TextStyle(
                              color: theme.colorScheme.onErrorContainer)),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _loading ? null : _primaryAction,
                    icon: _loading
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : Icon(_buttonIcon),
                    label: Text(_buttonText),
                  ),
                  const SizedBox(height: 6),
                  _secondaryActions(),
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
        ],
        if (showPassword) ...[
          const SizedBox(height: 12),
          TextField(
            controller: _passwordCtrl,
            decoration: const InputDecoration(
              labelText: 'Password',
              prefixIcon: Icon(Icons.lock_outline),
            ),
            obscureText: true,
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
            decoration: const InputDecoration(
              labelText: 'Confirm password',
              prefixIcon: Icon(Icons.verified_user_outlined),
            ),
            obscureText: true,
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
    if (_mode == _AuthMode.signUp && _otpSent) {
      return TextButton(
        onPressed: _loading ? null : _register,
        child: const Text('Send another code'),
      );
    }
    return TextButton(
      onPressed: _loading ? null : () => _setMode(_AuthMode.signIn),
      child: const Text('Back to sign in'),
    );
  }
}
