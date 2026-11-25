# proyecto-deportivo

Prototipo de plataforma web para consultar oportunidades deportivas del IPN
(actividades, becas y convocatorias), enfocado inicialmente en las unidades
académicas de Zacatenco.

> Proyecto estudiantil, no es un sitio oficial del IPN. Los datos incluidos en
> `db/seed.sql` son **de ejemplo** (horarios, cupos y fechas ficticios) y deben
> sustituirse por información verificada antes de las pruebas con estudiantes.

## Qué incluye

- Catálogo con filtros por tipo, unidad académica, disciplina, día, franja
  horaria, vigencia y texto.
- Detalle de cada oportunidad: horarios y sedes, requisitos, contacto, fuentes,
  enlace oficial, fecha de actualización y de última verificación.
- Cuentas de estudiante: registro, inicio de sesión, oportunidades guardadas,
  reportes de información incorrecta y notificaciones cuando cambia una
  oportunidad guardada.
- Panel de administración: alta, edición y baja de oportunidades, verificación,
  atención de reportes e historial de cambios.

## Tecnología

Node.js + Express, PostgreSQL y una interfaz en HTML/CSS/JavaScript sin
frameworks. El esquema (`db/schema.sql`) implementa las 18 entidades del
diagrama E-R; la especialización de OPORTUNIDAD en ACTIVIDAD, BECA y
CONVOCATORIA usa una tabla por subtipo que comparte la llave primaria.

```
db/schema.sql        Tablas, llaves y restricciones
db/seed.sql          Datos de ejemplo
scripts/db-reset.js  Crea el esquema, carga los datos y el administrador
src/server.js        Servidor Express
src/routes/          API: publico.js, cuenta.js, admin.js
public/              Interfaz (index.html, css/, js/app.js)
```

## Instalación en AlmaLinux (también dentro de WSL)

### 1. Node.js, PostgreSQL y Git

En AlmaLinux 9 hay que elegir versiones recientes (en AlmaLinux 10 omite las
dos líneas de `dnf module`):

```bash
sudo dnf module enable -y nodejs:22
```

```bash
sudo dnf module enable -y postgresql:16
```

```bash
sudo dnf install -y nodejs postgresql-server git
```

### 2. Iniciar PostgreSQL

```bash
sudo postgresql-setup --initdb
```

Permite el acceso con contraseña desde la propia máquina (por defecto
AlmaLinux usa `ident`, que rechaza la conexión de la aplicación):

```bash
sudo sed -i 's/\(^host.*\)ident$/\1md5/' /var/lib/pgsql/data/pg_hba.conf
```

```bash
sudo systemctl enable --now postgresql
```

Si `systemctl` responde que systemd no está activo (pasa en algunas
instalaciones de WSL), inicia el servidor así cada vez que abras la terminal:

```bash
sudo -u postgres pg_ctl -D /var/lib/pgsql/data -l /tmp/postgres.log start
```

### 3. Crear el usuario y la base de datos

```bash
sudo -u postgres psql -c "CREATE USER deportes WITH PASSWORD 'deportes'" -c "CREATE DATABASE deportes_ipn OWNER deportes"
```

### 4. Configurar y arrancar el proyecto

Dentro de la carpeta del proyecto:

```bash
npm install
```

```bash
cp .env.example .env
```

Edita `.env` (al menos `JWT_SECRET` y `ADMIN_PASSWORD`) y después crea las
tablas con los datos de ejemplo. **Este comando borra las tablas existentes:**

```bash
npm run db:reset
```

```bash
npm start
```

Abre <http://localhost:3000> en el navegador de Windows. Para entrar al panel
de administración usa el correo y la contraseña definidos en `.env`
(`admin@ejemplo.mx` / `admin1234` si no los cambiaste).

Durante el desarrollo, `npm run dev` reinicia el servidor al guardar cambios.

## API

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/api/catalogos` | Público |
| GET | `/api/oportunidades?tipo&unidad&disciplina&dia&desde&hasta&estado&q` | Público |
| GET | `/api/oportunidades/:id` | Público |
| POST | `/api/auth/registro`, `/api/auth/login`, `/api/auth/logout` | Público |
| GET | `/api/auth/yo` | Público |
| GET, PUT, DELETE | `/api/guardadas`, `/api/guardadas/:id` | Sesión |
| POST | `/api/oportunidades/:id/reportes` | Sesión |
| GET, POST | `/api/notificaciones`, `/api/notificaciones/leidas` | Sesión |
| GET, POST, PUT, DELETE | `/api/admin/oportunidades[/:id]` | Administrador |
| POST | `/api/admin/oportunidades/:id/verificaciones` | Administrador |
| GET, PATCH | `/api/admin/reportes[/:id]` | Administrador |
| GET | `/api/admin/historial` | Administrador |

## Pendiente

- Sustituir los datos de ejemplo por información verificada.
- Las tablas `usuario_disciplina` (preferencias), `sede_disciplina` y las
  coordenadas de las sedes existen en el esquema pero aún no tienen pantalla.
- Antes de publicar en internet: HTTPS, límite de intentos de inicio de sesión
  y recuperación de contraseña.
