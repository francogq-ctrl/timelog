# Test: Calendar Popup Sin Logout

## Preparación

1. Conectarse como admin a `http://localhost:3000/log`

2. Para simular un token expirado sin refresh_token:
   ```bash
   psql $DATABASE_URL -c "UPDATE accounts SET refresh_token = NULL, expires_at = 0 WHERE provider = 'google' AND \"userId\" = '<tu-user-id>'"
   ```

## Test Pasos

### 1. Intenta importar desde Calendar
- Haz clic en el botón **"Import from Calendar"**
- Debería abrirse un modal cargando eventos
- Si ves el banner naranja: **"Calendar access needs refresh"** ✓

### 2. Haz clic en "Reconnect now"
- Se abre un **popup** con Google OAuth
- NO deberías ver una pantalla de logout
- El tab principal sigue en `/log` sin cambios ✓

### 3. Autoriza en Google
- En el popup, autoriza el acceso a Calendar
- Deberías ver: **"Calendar Connected"** en el popup
- El popup se cierra automáticamente en ~1.5s ✓

### 4. Verifica que funciona
- De vuelta en el tab principal
- El modal debería estar cargando eventos nuevamente
- Los eventos deberían aparecer sin errores ✓
- **NO hubo logout/login completo** ✓

### 5. Verifica en BD
```bash
psql $DATABASE_URL -c "SELECT access_token IS NOT NULL, refresh_token IS NOT NULL, expires_at FROM accounts WHERE provider = 'google' AND \"userId\" = '<tu-user-id>';"
```
- `access_token`: `true` ✓
- `refresh_token`: `true` ✓ (fue `false` antes)
- `expires_at`: number > 0 ✓

## Success Criteria

- ✅ Popup OAuth sin logout completo
- ✅ Sesión sigue activa en tab principal
- ✅ Refresh token se guarda en BD
- ✅ Eventos se cargan automáticamente después
- ✅ No hay necesidad de refrescar la página

## Qué Pasó Internamente

1. Click "Reconnect now" → `handleReconnect()` en ComponentCalendarImport
2. `window.open("/api/auth/calendar-connect")` → popup
3. Popup redirige a Google OAuth
4. Google redirige a `/auth/calendar-callback?code=...&state=...`
5. Popup usa `useSearchParams()` para leer el code
6. Popup hace fetch a `/api/auth/calendar-callback?code=...&state=...`
7. API endpoint intercambia el code por tokens en Google
8. API endpoint actualiza la tabla `accounts` en BD
9. Popup hace `window.opener.postMessage("calendar_connected", ...)`
10. Component escucha el mensaje → ejecuta `fetchEvents()` automáticamente
11. Popup se cierra
12. Modal principal muestra eventos nuevamente
