AgroRosario

Aplicación web de comunicación interna para Agroquímica Rosario, desarrollada como Trabajo Práctico en UTN FRRo (Ingeniería en Sistemas de Información).

Descripción

AgroRosario digitaliza la comunicación entre los vendedores y la administración de una empresa agroquímica, reemplazando la gestión manual (llamadas telefónicas y mensajes de WhatsApp) por una plataforma centralizada. Permite planificar objetivos comerciales, organizar hojas de ruta, registrar el resultado de cada visita o llamada, y hacer seguimiento del proceso de ventas de punta a punta.

Objetivo

Optimizar la operativa comercial de la empresa mediante:


La asignación de objetivos semanales de visitas y ventas a cada vendedor.
La organización de hojas de ruta.
El registro estructurado de actividades en campo (visitas, llamadas, adjuntos).
El seguimiento del proceso comercial de cada cliente, desde el primer contacto hasta el cierre de la venta.
La generación de tareas de seguimiento y reportes para la administración.


Roles de usuario

RolPermisos principalesAdministraciónAsigna objetivos y hojas de ruta a los vendedores, crea tareas de seguimiento, gestiona promociones, visualiza reportes y estadísticas de todo el equipo.VendedorConsulta sus objetivos y hoja de ruta asignados, registra actividades (visitas/llamadas) con adjuntos, hace seguimiento de sus clientes y oportunidades.

Funcionalidades principales


Gestión de usuarios: registro, login y permisos diferenciados por rol (JWT).
Objetivos y hoja de ruta: la administración define metas semanales (clientes a visitar, productos a ofrecer, promociones vigentes) y arma rutas para cada vendedor.
Registro de actividades: formulario de carga de visitas/llamadas, con adjuntos (fotos, documentos, audios) y generación automática de tareas de seguimiento.
Seguimiento comercial (pipeline): cada relación comercial se rastrea como una oportunidad, con su propio estado (Prospecto → Lead → Negociación → Activo/Perdido), volumen potencial y facturado.
Panel de administración: visualización del progreso del equipo, reportes semanales/mensuales y alertas (clientes sin contacto, oportunidades estancadas).


Arquitectura y stack tecnológico

El proyecto se desarrolla bajo arquitectura MVC:


Backend: Node.js + Express (JavaScript)
Frontend: HTML + CSS
Base de datos: MySQL
Autenticación: JWT


Modelo de dominio (resumen)

Entidades principales del sistema:


Usuario (superclase) → Administrador, Vendedor
Cliente (contacto de una empresa) y EmpresaCliente (cuenta comercial: CUIT, superficie, tipo de empresa)
Oportunidad: negociación puntual entre un vendedor y una empresa cliente, con su propio estado y volumen de venta
FormularioActividad: registro de cada visita/llamada realizada, con adjuntos
Objetivo: meta semanal asignada por la administración a un vendedor
HojaRuta y Tarea: creadas por la administración y asignadas a un vendedor
Servicio, LineaProd, Cultivo, TipoProd: catálogos comerciales y agronómicos
Localidad / Provincia: ubicación geográfica de las empresas cliente
Promocion: promociones vigentes sobre líneas de producto
Nota: comunicación interna entre administradores (pedidos y despachos)


El modelo completo, con atributos y multiplicidades, se documenta por separado como parte del análisis de diseño del proyecto.

Metodología de trabajo

El proyecto sigue un enfoque en cascada, con documentación formal versionada en cada etapa (minutas de reunión, especificación de requerimientos, modelo de dominio). Cada entregable queda registrado con su fecha, versión y autor para mantener trazabilidad de los cambios.

Repositorios


Backend: Agro-Ros-DSS-UTN/Backend
Frontend: Agro-Ros-DSS-UTN/Frontend


Integrantes: 
 ● 54756 Jager, Mateo 
● 54508 Torrezan, Marco 
●54162 Oertlin Merini, Maria Victoria
 ● 54400 Fernandez Gonzalez, Manuel 




Instalación y uso

Próximamente.

Documentación

La especificación funcional completa y las minutas de reunión se encuentran en la carpeta de documentación del proyecto.
