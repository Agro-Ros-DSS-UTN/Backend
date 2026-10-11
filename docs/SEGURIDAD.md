# Correcciones de seguridad (v2)

Cada punto indica el problema que había en la v1, el riesgo y cómo quedó resuelto.
Todos están cubiertos por `scripts/security-tests.mjs` (147 comprobaciones, todas en verde contra una copia con la estructura exacta de producción ya migrada).

## Críticos

| # | Problema en v1 | Riesgo | Solución |
|---|---|---|---|
| 1 | La pantalla de login guardaba **usuario y contraseña en texto plano** en el navegador ("Guardar contraseña"). | Cualquiera con acceso al equipo o a una extensión maliciosa leía la clave. | Se quitó. Al abrir el login se **borra** lo que hubiera quedado guardado. La opción ahora es "Mantener la sesión iniciada" (token de 3 días, nunca la contraseña — P-5). |
| 2 | En el código de `main` (el que está en producción) **10 grupos de rutas respondían sin sesión**: `/dashboard`, `/tasks`, `/roadmaps`, `/objectives`, `/promotions`, `/internal-notes`, `/empleados`, `/ordenes-servicio` (con firmas) y `/formulario-actividad`. Verificado levantando la v1 contra la base de prueba. | Cualquiera en internet podía leer la cartera de clientes, órdenes, actividades y notas, y crear o modificar registros. | Toda la API exige token salvo login y `/api/health`. El tablero es solo para administración. |
| 3 | Varias rutas no tenían control de rol (crear usuarios, borrar empresas, órdenes, empleados, objetivos…). | Un vendedor podía crear un admin o borrar datos. | Permisos por rol en cada ruta (`requireAdmin`) y reglas de propiedad en cada controlador. |
| 4 | El autor de una actividad, el creador de una tarea, etc. **los mandaba el navegador**. | Suplantación: registrar actividades a nombre de otro. | El usuario sale siempre del token. |
| 5 | Un vendedor veía y editaba actividades, oportunidades, tareas y hojas de ruta de otros. | Exposición entre vendedores. | Filtros de propiedad: cada vendedor ve lo suyo (y lo sin asignar); los intentos sobre lo ajeno devuelven 403. El vendedor solo da de baja lo que cargó él (P-3). |
| 6 | Popups del mapa armados con HTML sin escapar y enlaces de paradas sin validar (`javascript:`). | XSS: robo de la sesión de quien abra el mapa. | Texto escapado en popups; solo se aceptan enlaces `http(s)` (validado en backend y frontend). |
| 7 | Adjuntos y firmas aceptaban cualquier contenido. | Subir HTML/scripts disfrazados de imagen. | Solo imágenes, audio y PDF, con tamaño máximo; firmas solo imagen. |
| 8 | Órdenes de servicio (con firmas y datos de clientes) se copiaban al `localStorage`, y si fallaba el servidor se mostraban **órdenes de ejemplo** como reales. | Datos sensibles en el navegador; información falsa. | Ya no se guardan en el navegador (y se borra la copia vieja); sin conexión se informa el error. |

## Altos

| # | Problema | Solución |
|---|---|---|
| 9 | Sin límite de intentos de login. | 5 intentos fallidos por usuario y 30 por IP cada 15 minutos (respuesta 429). |
| 10 | Mensajes distintos para "usuario inexistente" y "contraseña incorrecta". | Mismo mensaje y mismo tiempo de respuesta (comparación contra un hash ficticio). |
| 11 | Un token seguía sirviendo después de cambiar la contraseña, el rol o desactivar la cuenta. | `token_version` en usuarios: esos cambios cierran todas las sesiones. Las cuentas inactivas no pueden operar. |
| 12 | `JWT_SECRET` podía faltar o ser corto. | El servidor no arranca sin una clave de 32+ caracteres; tokens con emisor, audiencia y algoritmo fijos. |
| 13 | Cambiar la contraseña de otro usuario no pedía confirmación real. | El admin confirma con su propia contraseña y el **servidor** la verifica. |
| 14 | Los controladores copiaban `req.body` entero al modelo. | Lista blanca de campos en cada alta/edición (no se puede tocar id, fechas internas, etc.). |
| 15 | Errores con detalle técnico (SQL, stack) al cliente. | Mensajes claros en español; el detalle solo en el log del servidor. |
| 16 | CORS abierto y sin cabeceras de seguridad. | CORS solo para el dominio del frontend; `nosniff`, `X-Frame-Options`, CSP de API, HSTS en producción, sin `X-Powered-By`. |
| 17 | Cuerpo de hasta 50 MB por pedido. | 15 MB (suficiente para fotos y firmas) y validación por archivo. |
| 18 | Conexión a MySQL sin verificar el certificado. | Se puede verificar con `DB_SSL_CA`; si no se configura, avisa en el log. |
| 19 | Recordatorios por mail con texto del usuario sin escapar. | Escapado de todo el contenido del mail. |
| 20 | El servidor aceptaba contraseñas de 8 caracteres con letras y números, aunque las pantallas pedían más. | Una sola regla en servidor y pantallas (P-6): 8 a 64 caracteres, con mayúscula, número y símbolo. Las contraseñas actuales siguen funcionando; la regla se aplica al crear o cambiar. |
| 21 | Una actividad cargada sin conexión se perdía si al reconectar la sesión estaba vencida. | Queda en la cola hasta volver a iniciar sesión; si el servidor la rechaza por los datos, se muestra con el motivo para cargarla de nuevo. |

## Integridad de datos (también eran riesgos)

- `sequelize.sync()` al arrancar podía alterar tablas en producción → reemplazado por migraciones versionadas; el servidor no arranca con migraciones pendientes.
- Bajas físicas en cascada (borrar una empresa borraba contactos y negocios) → **baja lógica** en empresas, contactos, oportunidades y órdenes, con restauración.
- Claves foráneas con reglas explícitas (56) y limpieza de referencias huérfanas.
- Valores de producción en minúscula (`activo`, `admin`, `Visita`) → normalizados con escritura forzada; sin esto, con la collation de producción, nadie habría podido iniciar sesión después de migrar.
- Hora de las actividades corrida 3 horas → corregida en los datos y en el código (sin zona = hora de Argentina).
- Datos inventados por el frontend (CUIT y DNI aleatorios, coordenadas falsas, stock fijo en 100, "Ruta Provincial", localidad "Casilda") → eliminados.
- Usuarios inactivos aparecían como asignables (`'Inactivo'.includes('activ')`) → corregido.
