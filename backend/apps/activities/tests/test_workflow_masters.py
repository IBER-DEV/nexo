"""CRUD y reglas de negocio de los maestros de flujo: WorkflowState,
Priority, ActivityType, y el bootstrap /workspace/."""
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.models import Priority, WorkflowState

from .factories import ensure_masters, make_org, make_user


class WorkflowStateCrudTests(APITestCase):
    def setUp(self):
        self.org = make_org("wf", "WF Org")
        self.admin = make_user("admin@wf.com", "Admin", rol="admin", organization=self.org)
        self.member = make_user("member@wf.com", "Member", organization=self.org)
        self.masters = ensure_masters(self.org)

    def test_member_can_list_but_not_write(self):
        self.client.force_authenticate(self.member)
        res = self.client.get("/api/v1/workflow-states/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 6)
        res = self.client.post(
            "/api/v1/workflow-states/",
            {"nombre": "Nuevo", "color": "#123456", "categoria": "todo"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_with_auto_slug(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            "/api/v1/workflow-states/",
            {"nombre": "En Revisión", "color": "#123456", "categoria": "active"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["slug"], "en-revision")

    def test_sheet_phase_roundtrip(self):
        self.client.force_authenticate(self.admin)
        state = self.masters["states"]["testing"]
        res = self.client.patch(
            f"/api/v1/workflow-states/{state.pk}/",
            {"sheet_phase": "QA"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["sheet_phase"], "QA")
        state.refresh_from_db()
        self.assertEqual(state.external_mappings["google_sheets"], "QA")

    def test_only_one_initial_state(self):
        self.client.force_authenticate(self.admin)
        testing = self.masters["states"]["testing"]
        res = self.client.patch(
            f"/api/v1/workflow-states/{testing.pk}/", {"is_initial": True}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        backlog = self.masters["states"]["backlog"]
        backlog.refresh_from_db()
        self.assertFalse(backlog.is_initial)
        testing.refresh_from_db()
        self.assertTrue(testing.is_initial)

    def test_cannot_archive_initial_state(self):
        self.client.force_authenticate(self.admin)
        backlog = self.masters["states"]["backlog"]
        res = self.client.patch(
            f"/api/v1/workflow-states/{backlog.pk}/", {"is_active": False}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_delete_initial_state(self):
        self.client.force_authenticate(self.admin)
        backlog = self.masters["states"]["backlog"]
        res = self.client.delete(f"/api/v1/workflow-states/{backlog.pk}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_remove_last_done_state(self):
        self.client.force_authenticate(self.admin)
        done = self.masters["states"]["done"]
        res = self.client.delete(f"/api/v1/workflow-states/{done.pk}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        res = self.client.patch(
            f"/api/v1/workflow-states/{done.pk}/", {"is_active": False}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reorder(self):
        self.client.force_authenticate(self.admin)
        states = WorkflowState.objects.for_org(self.org).order_by("orden")
        ids = list(states.values_list("pk", flat=True))
        reversed_ids = list(reversed(ids))
        res = self.client.post(
            "/api/v1/workflow-states/reorder/", {"ids": reversed_ids}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        new_order = [row["id"] for row in res.data]
        self.assertEqual(new_order, reversed_ids)

    def test_isolated_between_orgs(self):
        other_org = make_org("wf-otra", "WF Otra")
        ensure_masters(other_org)
        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/v1/workflow-states/")
        orgs_seen = {WorkflowState.objects.get(pk=row["id"]).organization_id for row in res.data}
        self.assertEqual(orgs_seen, {self.org.pk})


class PriorityCrudTests(APITestCase):
    def setUp(self):
        self.org = make_org("pr", "Priority Org")
        self.admin = make_user("admin@pr.com", "Admin", rol="admin", organization=self.org)
        self.masters = ensure_masters(self.org)

    def test_only_one_default_priority(self):
        self.client.force_authenticate(self.admin)
        high = self.masters["priorities"]["high"]
        res = self.client.patch(
            f"/api/v1/priorities/{high.pk}/", {"is_default": True}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        medium = self.masters["priorities"]["medium"]
        medium.refresh_from_db()
        self.assertFalse(medium.is_default)

    def test_reorder(self):
        self.client.force_authenticate(self.admin)
        ids = list(Priority.objects.for_org(self.org).order_by("orden").values_list("pk", flat=True))
        reversed_ids = list(reversed(ids))
        res = self.client.post("/api/v1/priorities/reorder/", {"ids": reversed_ids}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)


class ActivityTypeCrudTests(APITestCase):
    def setUp(self):
        self.org = make_org("at", "Type Org")
        self.admin = make_user("admin@at.com", "Admin", rol="admin", organization=self.org)

    def test_admin_can_crud(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            "/api/v1/activity-types/", {"nombre": "Incidente", "color": "#E5484D"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)


class WorkspaceViewTests(APITestCase):
    def setUp(self):
        self.org = make_org("ws", "Workspace Org")
        self.admin = make_user("admin@ws.com", "Admin", rol="admin", organization=self.org)
        ensure_masters(self.org)

    def test_workspace_bootstrap_shape(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/v1/workspace/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["organization"]["slug"], "ws")
        self.assertEqual(len(res.data["workflow_states"]), 6)
        self.assertEqual(len(res.data["priorities"]), 4)
        self.assertIn("version", res.data)
        self.assertIn("schema_version", res.data)

    def test_version_changes_after_mutation(self):
        self.client.force_authenticate(self.admin)
        before = self.client.get("/api/v1/workspace/").data["version"]
        state = WorkflowState.objects.for_org(self.org).first()
        self.client.patch(
            f"/api/v1/workflow-states/{state.pk}/", {"color": "#000000"}, format="json"
        )
        after = self.client.get("/api/v1/workspace/").data["version"]
        self.assertNotEqual(before, after)
