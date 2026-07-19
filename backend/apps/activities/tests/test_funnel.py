"""El embudo de signup se cierra cuando una organización crea su primera
actividad — ver apps/organizations/funnel.py y el receiver en signals.py."""
from unittest import mock

from rest_framework.test import APITestCase

from .factories import activity_payload, make_activity, make_user


class FirstActivityFunnelTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.client.force_authenticate(self.admin)

    @mock.patch("apps.activities.signals.track")
    def test_first_activity_in_org_tracks_funnel_event(self, mock_track):
        res = self.client.post(
            "/api/v1/activities/", activity_payload(self.admin), format="json"
        )
        self.assertEqual(res.status_code, 201, res.data)
        mock_track.assert_called_once_with(
            "first_activity_created", organization=self.admin.organization
        )

    @mock.patch("apps.activities.signals.track")
    def test_second_activity_in_org_does_not_track_again(self, mock_track):
        make_activity(self.admin)  # ya existe una — numero=1 tomado
        mock_track.reset_mock()
        res = self.client.post(
            "/api/v1/activities/", activity_payload(self.admin), format="json"
        )
        self.assertEqual(res.status_code, 201, res.data)
        mock_track.assert_not_called()
