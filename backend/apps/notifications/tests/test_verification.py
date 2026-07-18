from unittest import mock

from django.core import mail
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import signup_payload
from apps.notifications.tokens import make_verification_token
from apps.users.models import User


class SignupEmailTests(APITestCase):
    """El signal user_registered dispara el correo real (vía el listener
    desacoplado en apps.notifications) sin que SignupService sepa nada de
    esto — se verifica observando el outbox, no llamando emails.py directo."""

    def test_signup_sends_verification_email(self):
        # user_registered se emite en transaction.on_commit — TestCase envuelve
        # cada test en una transacción que nunca hace commit real, así que hay
        # que forzar la ejecución de esos callbacks explícitamente.
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/v1/auth/signup/", signup_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [signup_payload()["email"]])
        self.assertIn("/verify-email?token=", mail.outbox[0].body)

    def test_user_not_verified_right_after_signup(self):
        res = self.client.post("/api/v1/auth/signup/", signup_payload(), format="json")
        self.assertFalse(res.data["user"]["email_verified"])


class EmailVerifyViewTests(APITestCase):
    def setUp(self):
        self.client.post("/api/v1/auth/signup/", signup_payload(), format="json")
        self.user = User.objects.get(email=signup_payload()["email"])

    def test_valid_token_marks_verified(self):
        token = make_verification_token(self.user)
        res = self.client.get(f"/api/v1/auth/email/verify/?token={token}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.email_verified_at)

    def test_confirming_twice_is_idempotent(self):
        token = make_verification_token(self.user)
        self.client.get(f"/api/v1/auth/email/verify/?token={token}")
        res = self.client.get(f"/api/v1/auth/email/verify/?token={token}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_garbage_token_returns_400(self):
        res = self.client.get("/api/v1/auth/email/verify/?token=not-a-real-token")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_token_returns_400(self):
        token = make_verification_token(self.user)
        with mock.patch("apps.notifications.tokens.MAX_AGE_SECONDS", -1):
            res = self.client.get(f"/api/v1/auth/email/verify/?token={token}")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class ResendVerificationViewTests(APITestCase):
    def setUp(self):
        with self.captureOnCommitCallbacks(execute=True):
            signup_res = self.client.post(
                "/api/v1/auth/signup/", signup_payload(), format="json"
            )
        self.user = User.objects.get(email=signup_payload()["email"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {signup_res.data['access']}")
        mail.outbox.clear()

    def test_resend_requires_authentication(self):
        self.client.credentials()
        res = self.client.post("/api/v1/auth/email/resend/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_resend_throttled_right_after_signup(self):
        res = self.client.post("/api/v1/auth/email/resend/")
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(len(mail.outbox), 0)

    def test_resend_sends_again_once_throttle_window_passed(self):
        self.user.email_verification_sent_at = timezone.now() - timezone.timedelta(minutes=5)
        self.user.save(update_fields=["email_verification_sent_at"])
        res = self.client.post("/api/v1/auth/email/resend/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

    def test_resend_when_already_verified_does_not_send(self):
        self.user.email_verified_at = timezone.now()
        self.user.save(update_fields=["email_verified_at"])
        res = self.client.post("/api/v1/auth/email/resend/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)
