import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  fetchAdminSettings,
  updateAdminSettings,
  selectAdminSettings,
  selectAdminSettingsLoading,
  selectAdminSettingsSaving,
  selectAdminSettingsSaveError,
} from "@/store/slices/adminSettingsSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSettings() {
  const user = useAppSelector(selectAdminUser);
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectAdminSettings);
  const loading = useAppSelector(selectAdminSettingsLoading);
  const saving = useAppSelector(selectAdminSettingsSaving);
  const saveError = useAppSelector(selectAdminSettingsSaveError);
  const [appVersion, setAppVersion] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    dispatch(fetchAdminSettings());
  }, [dispatch]);

  useEffect(() => {
    const v = items.find((i) => i.setting_key === "app_version")?.setting_value;
    if (v) setAppVersion(v);
  }, [items]);

  if (user?.role !== "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  async function handleSave() {
    setSaved(false);
    await dispatch(
      updateAdminSettings([{ key: "app_version", value: appVersion.trim() }]),
    ).unwrap();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground">
          Ajustes globales del sitio. La versión también aparece en el footer
          público tras desplegar.
        </p>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>Configuración guardada.</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <div className="rounded-xl border p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app_version">Versión de la app</Label>
            <Input
              id="app_version"
              value={appVersion}
              onChange={(e) => setAppVersion(e.target.value)}
              placeholder="v1.0.0"
            />
            <p className="text-xs text-muted-foreground">
              Usa <code className="text-xs">npm run deploy:prod</code> para
              desplegar y actualizar automáticamente.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || !appVersion.trim()}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      )}
    </div>
  );
}
