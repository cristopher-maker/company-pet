# Company Pet

Estructura base de una app web con Ionic + Angular (en español) para iniciar un sitio/app tipo corporativa.

## Requisitos
- Node.js 18+ (recomendado 20+)
- (Opcional) Ionic CLI instalado globalmente (`npm i -g @ionic/cli`)

Nota (Windows/PowerShell): si te bloquea `ionic.ps1` por política de ejecución, puedes usar `npx ionic ...`
o habilitar scripts con una ExecutionPolicy adecuada.

## Primeros pasos
1) Instalar dependencias:
   - `npm install`
2) Levantar en desarrollo:
   - `npm start`

## Publicar en GitHub Pages
1) Generar build para Pages:
   - `npm run build:gh`
2) Publicar:
   - `npm run deploy`

La URL quedará en:
`https://cristopher-maker.github.io/companypet/`

## Si falla por versión de Node/Angular
Si ves un error tipo “Angular CLI requires a minimum Node.js version…”, y no puedes actualizar Node, baja la versión
de Angular y reinstala:
- borra `node_modules` y `package-lock.json`
- corre `npm install`

Si ves un error tipo “tslib.d.ts is not a module” en VS Code:
- asegúrate de reinstalar dependencias (pasos arriba)
- en VS Code ejecuta: “TypeScript: Select TypeScript Version” → “Use Workspace Version”
- y luego: “TypeScript: Restart TS Server”

## Supabase (credenciales)
Pon tu Project URL y tu anon key en:
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Importante: NO uses la service_role key en el frontend (Ionic). Esa va solo en servidor/Edge Functions.

## Home (qué debe ser)
`/home` funciona como dashboard y cambia según el rol del usuario en Supabase (`public.profiles.role`):
- `employee`: accesos al portal, seguimiento (`/requests`) y vouchers (`/vouchers`)
- `admin` / `company_admin`: acceso a Panel Empresa (`/company`)

## Páginas incluidas
- Inicio: `/home`
- Asesoría personalizada: `/care-experts`
- Proveedores verificados: `/providers`
- Recursos digitales: `/resources`
- Formación: `/training`
- Nosotros: `/about`
- Servicios: `/services`
- Contacto: `/contact`
- 404: `**` (ruta comodín)
