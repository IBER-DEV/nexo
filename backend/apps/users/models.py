import hashlib
import secrets

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

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
    # Usuario compartido de la demo pública (login sin password vía
    # /auth/demo-login/): DenyDemoWrites (apps/users/permissions.py) rechaza
    # cualquier escritura suya en toda la API, sin importar el rol.
    is_demo_readonly = models.BooleanField(default=False)
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


class PersonalAccessToken(models.Model):
    """Credencial de larga vida para clientes que no pueden mantener una
    sesión de navegador — el caso que la motiva es MCP (conectar Nexo a un
    cliente de IA), pero sirve para cualquier script o integración.

    Existe porque el JWT no alcanza: el access token dura 8h y el refresh
    rota, así que un cliente que corre en la máquina de alguien se queda
    afuera cada mañana y no tiene forma de re-autenticarse solo.

    **El token nunca se guarda en claro.** Se almacena el sha256 y el valor
    real se muestra una única vez, al crearlo. Se usa sha256 y no un hasher
    de contraseñas (PBKDF2/bcrypt) a propósito: esos están diseñados para
    ser lentos porque protegen secretos de baja entropía elegidos por
    humanos. Acá el secreto son 256 bits aleatorios —no hay diccionario que
    lo alcance— y el hash corre en *cada* petición del API, donde el costo
    deliberado de PBKDF2 sería latencia pura.

    Un token nunca puede más que su dueño: la autorización sigue saliendo
    del rol del `user`. `scope` solo permite acotar *hacia abajo* — darle a
    una IA acceso de lectura sin poder escribir en el backlog.
    """

    PREFIX = "nxo_"
    # 12 caracteres visibles ("nxo_" + 8): suficiente para reconocer cuál es
    # cuál en una lista, muy poco para reconstruir el secreto.
    DISPLAY_PREFIX_LENGTH = 12
    # Escribir last_used_at en cada petición sería un UPDATE por request
    # sobre la tabla de tokens. La granularidad útil de "última vez usado"
    # se mide en minutos, no en milisegundos.
    LAST_USED_THROTTLE_SECONDS = 300

    class Scope(models.TextChoices):
        READ = "read", "Solo lectura"
        READ_WRITE = "read_write", "Lectura y escritura"

    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="access_tokens"
    )
    nombre = models.CharField(
        max_length=100,
        help_text="Para reconocerlo después: 'Claude Desktop', 'script de reportes'...",
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    prefix = models.CharField(max_length=16)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.READ_WRITE)
    expires_at = models.DateTimeField(null=True, blank=True)  # None = no expira
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "token de acceso personal"
        verbose_name_plural = "tokens de acceso personal"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.nombre} ({self.prefix}…) · {self.user.email}"

    @staticmethod
    def hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    @classmethod
    def issue(cls, *, user, nombre: str, scope: str = Scope.READ_WRITE, expires_at=None):
        """Crea el token y devuelve `(instancia, valor_en_claro)`. El valor
        en claro no vuelve a estar disponible: si se pierde, se revoca y se
        emite otro."""
        raw = f"{cls.PREFIX}{secrets.token_urlsafe(32)}"
        token = cls.objects.create(
            user=user,
            nombre=nombre,
            token_hash=cls.hash_token(raw),
            prefix=raw[: cls.DISPLAY_PREFIX_LENGTH],
            scope=scope,
            expires_at=expires_at,
        )
        return token, raw

    @property
    def is_expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= timezone.now()

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def is_usable(self) -> bool:
        return not self.is_revoked and not self.is_expired

    def revoke(self) -> None:
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=["revoked_at"])

    def touch(self) -> None:
        ahora = timezone.now()
        if (
            self.last_used_at is not None
            and (ahora - self.last_used_at).total_seconds() < self.LAST_USED_THROTTLE_SECONDS
        ):
            return
        # .update() y no .save(): esto corre en el camino caliente de cada
        # petición autenticada por token y no debe disparar signals ni
        # reescribir columnas que no cambiaron.
        type(self).objects.filter(pk=self.pk).update(last_used_at=ahora)
        self.last_used_at = ahora
