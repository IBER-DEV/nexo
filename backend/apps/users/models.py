from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models

from apps.organizations.scoping import OrgQuerySet


class UserManager(BaseUserManager.from_queryset(OrgQuerySet)):
    def create_user(self, email, nombre, password=None, **extra):
        if not email:
            raise ValueError("El email es obligatorio")
        extra.setdefault("rol", "member")
        user = self.model(email=self.normalize_email(email), nombre=nombre, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, nombre, password=None, **extra):
        extra.setdefault("rol", "admin")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, nombre, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        COORDINATOR = "coordinator", "Coordinador"
        MEMBER = "member", "Member"

    email = models.EmailField(unique=True)
    nombre = models.CharField(max_length=200)
    # Null solo para superusuarios de plataforma (operan vía el admin de
    # Django); todo usuario del API pertenece a una organización.
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="users",
    )
    rol = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    coordinador = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="equipo",
        limit_choices_to={"rol": Role.COORDINATOR},
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # Verificación de email no bloqueante (Fase 1, punto 4): la presencia de
    # email_verified_at es la señal de "verificado" (evita bool+datetime
    # redundantes). _sent_at solo sirve para el throttle de "Reenviar".
    email_verified_at = models.DateTimeField(null=True, blank=True)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre"]

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        ordering = ["nombre"]
        constraints = [
            # A lo sumo un Owner activo por organización. El signup crea al
            # primer usuario como Owner; RBAC completo (transferir propiedad,
            # más roles) es Fase 2, pero esta garantía vive en el esquema
            # desde ya.
            models.UniqueConstraint(
                fields=["organization"],
                condition=models.Q(rol="owner", is_active=True),
                name="unique_owner_per_organization",
            )
        ]

    def __str__(self):
        return f"{self.nombre} <{self.email}>"

    def clean(self):
        super().clean()
        if self.rol in (self.Role.OWNER, self.Role.ADMIN, self.Role.COORDINATOR) and self.coordinador_id is not None:
            raise ValidationError({"coordinador": "Solo los miembros pueden tener coordinador asignado."})
        if self.rol == self.Role.MEMBER and self.coordinador_id == self.pk:
            raise ValidationError({"coordinador": "Un usuario no puede ser su propio coordinador."})

    @property
    def iniciales(self) -> str:
        parts = self.nombre.split()
        return "".join(p[0].upper() for p in parts[:2]) if parts else "?"

    @property
    def is_admin(self) -> bool:
        return (
            self.is_superuser
            or self.is_staff
            or self.rol in (self.Role.OWNER, self.Role.ADMIN)
        )

    @property
    def is_coordinator(self) -> bool:
        return self.rol == self.Role.COORDINATOR

    def team_user_ids(self) -> list[int]:
        if not self.is_coordinator:
            return [self.pk]
        return list(self.equipo.values_list("pk", flat=True)) + [self.pk]
