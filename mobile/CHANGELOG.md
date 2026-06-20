# Changelog

## 1.0.13+14

- Restore the Search filter button and filter drawer with compact dropdown menus.

## 1.0.12+13

- Replace the failing disk-image cache path with Flutter's native image loader.

## 1.0.11+12

- Remove search filters and the funnel control.
- Keep listing dropdown menus compact and constrained to their option content.

## 1.0.10+11

- Add profile photo preview/upload, GPS location fill, and change password.
- Remove the profile refresh action and make edit profile open as a safer sheet.

## 1.0.9+10

- Show the other participant in message threads.
- Remove the duplicate search filter button.
- Refresh the image cache and improve slow-image placeholders.

## 1.0.8+9

- Redesign the profile screen with grouped account and marketplace controls.
- Package backend seed assets so listing and profile images load on Render.

## 1.0.7+8

- Remove Mailjet acceptance trace ids from OTP logs and user-facing notices.

## 1.0.6+7

- Return and display Mailjet delivery trace ids for OTP requests.
- Update OTP helper text to 10 minutes.

## 1.0.5+6

- Require Mailjet recipient message ids before reporting OTP email success.
- Log Mailjet OTP acceptance receipts for delivery debugging.

## 1.0.4+5

- Allow OTP resend after 1 minute.
- Make verification codes expire after 10 minutes.

## 1.0.3+4

- Treat Mailjet per-message failures as OTP delivery failures.
- Prevent failed Mailjet sends from creating a stuck active OTP.

## 1.0.2+3

- Allow a fresh OTP request immediately when email delivery fails.
- Keep the 30-minute single-code window only after Mailjet accepts delivery.

## 1.0.1+2

- Use Mailjet for all email verification and password-reset codes.
- Keep one active verification code per email for 30 minutes.
- Refresh the authentication screen with the PocketTrade brand mark.
