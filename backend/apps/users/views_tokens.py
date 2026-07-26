"""Gestión de tokens de acceso personal.

Cualquier usuario autenticado puede emitir tokens **para sí mismo**: un
token nunca puede más que su dueño, así que no hace falta que sea privilegio
de admin. Lo que sí es dura es la propiedad — el queryset filtra por
`request.user` y nunca por un id que venga de la petición, así que no hay
forma de listar ni revocar el token de otra persona.

Los tokens no pueden gestionar tokens: eso lo corta
`enforce_global_policy` en la capa de autenticación, no acá — es una regla
del mecanismo, no de esta vista.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.organizations.funnel import track

from .models import PersonalAccessToken
from .serializers_tokens import (
    PersonalAccessTokenCreateSerializer,
    PersonalAccessTokenSerializer,
)


class PersonalAccessTokenListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PersonalAccessTokenSerializer
    pagination_class = None

    def get_queryset(self):
        return PersonalAccessToken.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        entrada = PersonalAccessTokenCreateSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        token, raw = PersonalAccessToken.issue(
            user=request.user,
            nombre=entrada.validated_data["nombre"],
            scope=entrada.validated_data["scope"],
            expires_at=entrada.validated_data.get("expires_at"),
        )
        track(
            "access_token_created",
            organization=request.user.organization,
            user=request.user,
            scope=token.scope,
        )

        payload = PersonalAccessTokenSerializer(token).data
        # La única vez que el valor real sale del backend. A partir de acá
        # solo existe su sha256.
        payload["token"] = raw
        return Response(payload, status=status.HTTP_201_CREATED)


class PersonalAccessTokenRevokeView(generics.DestroyAPIView):
    """DELETE = revocar, no borrar: la fila queda como registro de que ese
    token existió y cuándo se usó por última vez. Un token revocado no
    autentica nada (lo verifica `PersonalAccessTokenAuthentication`)."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PersonalAccessToken.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        instance.revoke()
