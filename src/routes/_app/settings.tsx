import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useSound } from "@/providers/SoundProvider";
import { ROLE_LABEL } from "@/lib/types";
import { mastersService } from "@/services/mastersService";
import { MasterCrudSection } from "@/components/settings/MasterCrudSection";
import { WorkflowStatesManager } from "@/components/settings/WorkflowStatesManager";
import { PrioritiesManager } from "@/components/settings/PrioritiesManager";
import { OrganizationSettings } from "@/components/settings/OrganizationSettings";
import { useState } from "react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Configuración · Nexo" },
      { name: "description", content: "Preferencias del workspace y cuenta." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { enabled: soundEnabled, setSoundEnabled } = useSound();
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState("cuenta");

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" description="Tu cuenta y preferencias de la interfaz" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cuenta">Cuenta</TabsTrigger>
          {isAdmin && <TabsTrigger value="maestros">Maestros</TabsTrigger>}
          {isAdmin && <TabsTrigger value="organizacion">Organización</TabsTrigger>}
        </TabsList>

        <div key={tab} className="animate-fade-in mt-4">
          <TabsContent value="cuenta" className="space-y-6 mt-0">
            <Card className="p-6 space-y-5 max-w-2xl">
              <div>
                <h3 className="font-semibold">Perfil</h3>
                <p className="text-xs text-muted-foreground">
                  Datos de tu cuenta en Nexo (solo lectura; contacta al administrador para cambios).
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={user?.nombre ?? ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email ?? ""} readOnly />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Rol</Label>
                  <div>
                    <Badge variant="secondary">{user?.rol ? ROLE_LABEL[user.rol] : "—"}</Badge>
                  </div>
                </div>
                {user?.coordinador_nombre && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Coordinador</Label>
                    <Input value={user.coordinador_nombre} readOnly />
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6 space-y-5 max-w-2xl">
              <div>
                <h3 className="font-semibold">Apariencia</h3>
                <p className="text-xs text-muted-foreground">Personaliza la interfaz</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo oscuro</Label>
                  <p className="text-xs text-muted-foreground">
                    Activa el tema oscuro de la plataforma
                  </p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(c) => setTheme(c ? "dark" : "light")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Sonidos de interfaz</Label>
                  <p className="text-xs text-muted-foreground">
                    Reproduce señales sutiles al guardar, eliminar o mover actividades
                  </p>
                </div>
                <Switch
                  data-cuelume-toggle
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
              </div>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="maestros" className="space-y-6 mt-0">
              <WorkflowStatesManager />
              <PrioritiesManager />
              <div className="grid lg:grid-cols-2 gap-6">
                <MasterCrudSection
                  title="Tipos de actividad"
                  description="Categoriza actividades (Desarrollo, Soporte, Incidente...)."
                  queryKey={["masters", "activity-types"]}
                  invalidateKeys={[["workspace"]]}
                  service={mastersService.activityTypes}
                  withColor
                />
                <MasterCrudSection
                  title="Clientes"
                  description="Empresas para las que se hacen las actividades."
                  queryKey={["masters", "clientes"]}
                  invalidateKeys={[["activities-meta"]]}
                  service={mastersService.clientes}
                />
                <MasterCrudSection
                  title="Procesos"
                  description="Procesos de negocio asociados a cada actividad."
                  queryKey={["masters", "procesos"]}
                  invalidateKeys={[["activities-meta"]]}
                  service={mastersService.procesos}
                />
                <MasterCrudSection
                  title="Aplicaciones"
                  description="Sistemas o aplicaciones afectados."
                  queryKey={["masters", "aplicaciones"]}
                  invalidateKeys={[["activities-meta"]]}
                  service={mastersService.aplicaciones}
                />
                <MasterCrudSection
                  title="Stakeholders"
                  description="Interesados o áreas solicitantes."
                  queryKey={["masters", "stakeholders"]}
                  invalidateKeys={[["activities-meta"]]}
                  service={mastersService.stakeholders}
                />
              </div>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="organizacion" className="mt-0">
              <OrganizationSettings />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
