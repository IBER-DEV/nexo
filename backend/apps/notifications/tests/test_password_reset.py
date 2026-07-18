import re

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import signup_payload
from apps.users.models import User


class PasswordResetFlowTests(APITestCase):
    def setUp(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post("/api/v1/auth/signup/", signup_payload(), format="json")
        self.user = User.objects.get(email=signup_payload()["email"])
        mail.outbox.clear()

    def test_forgot_sends_email_when_user_exists(self):
        res = self.client.post(
            "/api/v1/auth/password/forgot/", {"email": self.user.email}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/reset-password?uid=", mail.outbox[0].body)

    def test_forgot_does_not_leak_user_existence(self):
        res_existing = self.client.post(
            "/api/v1/auth/password/forgot/", {"email": self.user.email}, format="json"
        )
        res_missing = self.client.post(
            "/api/v1/auth/password/forgot/", {"email": "nadie@nexo.dev"}, format="json"
        )
        self.assertEqual(res_existing.status_code, res_missing.status_code)
        self.assertEqual(res_existing.data, res_missing.data)
        self.assertEqual(len(mail.outbox), 1)  # solo el del usuario real

    def test_reset_end_to_end_new_password_works_old_does_not(self):
        self.client.post(
            "/api/v1/auth/password/forgot/", {"email": self.user.email}, format="json"
        )
        body = mail.outbox[0].body
        match = re.search(r"uid=([^&]+)&token=(\S+)", body)
        uid, token = match.group(1), match.group(2)

        res = self.client.post(
            "/api/v1/auth/password/reset/",
            {"uid": uid, "token": token, "new_password": "nueva-contrasena-456"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

        old_login = self.client.post(
            "/api/v1/auth/token/",
            {"email": self.user.email, "password": signup_payload()["password"]},
            format="json",
        )
        self.assertEqual(old_login.status_code, status.HTTP_401_UNAUTHORIZED)

        new_login = self.client.post(
            "/api/v1/auth/token/",
            {"email": self.user.email, "password": "nueva-contrasena-456"},
            format="json",
        )
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)

    def test_reset_invalid_token_returns_400(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        res = self.client.post(
            "/api/v1/auth/password/reset/",
            {"uid": uid, "token": "no-es-un-token-valido", "new_password": "nueva-contrasena-456"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_garbage_uid_returns_400(self):
        res = self.client.post(
            "/api/v1/auth/password/reset/",
            {"uid": "no-es-base64-valido", "token": "x", "new_password": "nueva-contrasena-456"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_weak_password_returns_400(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        res = self.client.post(
            "/api/v1/auth/password/reset/",
            {"uid": uid, "token": token, "new_password": "123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_token_invalidated_after_password_already_changed(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        self.user.set_password("otra-contrasena-789")
        self.user.save(update_fields=["password"])

        res = self.client.post(
            "/api/v1/auth/password/reset/",
            {"uid": uid, "token": token, "new_password": "nueva-contrasena-456"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
