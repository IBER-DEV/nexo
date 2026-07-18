from rest_framework import status
from rest_framework.test import APITestCase

from .factories import make_user


class AuthTests(APITestCase):
    def setUp(self):
        make_user("admin@test.com", "Admin", rol="admin", password="secret123")

    def test_token_obtain_with_valid_credentials(self):
        res = self.client.post(
            "/api/v1/auth/token/",
            {"email": "admin@test.com", "password": "secret123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

    def test_token_rejected_with_wrong_password(self):
        res = self.client.post(
            "/api/v1/auth/token/",
            {"email": "admin@test.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_activities_require_authentication(self):
        res = self.client.get("/api/v1/activities/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
