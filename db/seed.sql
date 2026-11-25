-- DATOS DE EJEMPLO para desarrollo y pruebas.
-- Los horarios, cupos, costos y fechas son ficticios: deben reemplazarse por
-- información verificada en las fuentes oficiales antes de usar el prototipo
-- con estudiantes. Se ejecuta sobre un esquema recién creado (ids desde 1).

INSERT INTO unidad_academica (nombre, siglas, nivel_educativo, zona) VALUES
 ('Escuela Superior de Cómputo', 'ESCOM', 'Superior', 'Zacatenco'),
 ('Escuela Superior de Ingeniería Mecánica y Eléctrica, Unidad Zacatenco', 'ESIME Zacatenco', 'Superior', 'Zacatenco'),
 ('Escuela Superior de Ingeniería y Arquitectura, Unidad Zacatenco', 'ESIA Zacatenco', 'Superior', 'Zacatenco'),
 ('Escuela Superior de Física y Matemáticas', 'ESFM', 'Superior', 'Zacatenco'),
 ('Escuela Superior de Ingeniería Química e Industrias Extractivas', 'ESIQIE', 'Superior', 'Zacatenco'),
 ('Unidad Profesional Interdisciplinaria en Ingeniería y Tecnologías Avanzadas', 'UPIITA', 'Superior', 'Zacatenco');

INSERT INTO sede (id_unidad, nombre, direccion, horario_acceso) VALUES
 (1, 'Canchas ESCOM',               'Unidad Profesional Adolfo López Mateos, Zacatenco, CDMX', 'Lun a Vie 7:00–21:00'),
 (1, 'Gimnasio ESCOM',              'Unidad Profesional Adolfo López Mateos, Zacatenco, CDMX', 'Lun a Vie 8:00–20:00'),
 (2, 'Canchas ESIME Zacatenco',     'Unidad Profesional Adolfo López Mateos, Zacatenco, CDMX', 'Lun a Vie 7:00–21:00'),
 (3, 'Área deportiva ESIA Zacatenco','Unidad Profesional Adolfo López Mateos, Zacatenco, CDMX', 'Lun a Vie 7:00–20:00'),
 (4, 'Salón de usos múltiples ESFM','Unidad Profesional Adolfo López Mateos, Zacatenco, CDMX', 'Lun a Vie 9:00–19:00'),
 (6, 'Canchas UPIITA',              'Av. Instituto Politécnico Nacional, Zacatenco, CDMX',      'Lun a Vie 7:00–21:00');

INSERT INTO disciplina (nombre, descripcion) VALUES
 ('Fútbol soccer', 'Deporte de conjunto'),
 ('Básquetbol',    'Deporte de conjunto'),
 ('Voleibol',      'Deporte de conjunto'),
 ('Atletismo',     'Pista y campo'),
 ('Natación',      'Deporte acuático'),
 ('Taekwondo',     'Deporte de combate'),
 ('Ajedrez',       'Deporte mental'),
 ('Acondicionamiento físico', 'Actividad física general');

INSERT INTO sede_disciplina (id_sede, id_disciplina) VALUES
 (1,1),(1,2),(1,3),(2,6),(2,8),(3,1),(3,2),(4,3),(4,4),(5,7),(6,1),(6,2);

INSERT INTO organizador (nombre, tipo_organizador) VALUES
 ('Dirección de Actividades Deportivas del IPN', 'Dirección de área'),
 ('Departamento de Servicios Estudiantiles ESCOM', 'Unidad académica'),
 ('Dirección de Apoyos a Estudiantes del IPN', 'Dirección de área'),
 ('Coordinación deportiva UPIITA', 'Unidad académica');

INSERT INTO contacto (id_organizador, tipo_contacto, valor) VALUES
 (1, 'web', 'https://www.ipn.mx/deportes/'),
 (2, 'web', 'https://www.escom.ipn.mx/SSEIS/serviciosestudiantiles/servicios/actsDeportivas.php'),
 (2, 'presencial', 'Ventanilla de Servicios Estudiantiles (ejemplo)'),
 (3, 'web', 'https://www.ipn.mx/daes/servicios/becas/'),
 (4, 'correo', 'deportes.upiita@ejemplo.mx');

-- Oportunidades (1–5 actividades, 6–7 becas, 8–9 convocatorias)
INSERT INTO oportunidad (id_organizador, titulo, descripcion, tipo, estado_vigencia, url_oficial, destacada) VALUES
 (2, 'Entrenamiento de básquetbol (ejemplo)', 'Entrenamientos abiertos para la comunidad estudiantil, todos los niveles.', 'actividad', 'vigente', 'https://www.escom.ipn.mx/SSEIS/serviciosestudiantiles/servicios/actsDeportivas.php', TRUE),
 (2, 'Taller de taekwondo (ejemplo)', 'Clases para principiantes e intermedios. Se requiere ropa deportiva.', 'actividad', 'vigente', 'https://www.escom.ipn.mx/SSEIS/serviciosestudiantiles/servicios/actsDeportivas.php', FALSE),
 (4, 'Fútbol soccer representativo (ejemplo)', 'Entrenamiento del equipo representativo; hay visorías al inicio del semestre.', 'actividad', 'vigente', 'https://www.ipn.mx/deportes/', FALSE),
 (1, 'Club de ajedrez (ejemplo)', 'Sesiones de práctica y torneos internos relámpago.', 'actividad', 'vigente', 'https://www.ipn.mx/deportes/', FALSE),
 (1, 'Voleibol mixto recreativo (ejemplo)', 'Retas y entrenamiento recreativo, sin inscripción previa.', 'actividad', 'proxima', 'https://www.ipn.mx/deportes/', FALSE),
 (3, 'Beca Deportiva', 'Apoyo para estudiantes que representan al IPN en competencias. Consulta montos y fechas en la convocatoria oficial.', 'beca', 'vigente', 'https://www.ipn.mx/daes/servicios/becas/', TRUE),
 (3, 'Beca Jacinto Licea', 'Apoyo dirigido a estudiantes deportistas. Consulta montos y fechas en la convocatoria oficial.', 'beca', 'vigente', 'https://www.ipn.mx/daes/servicios/becas/', FALSE),
 (1, 'Torneo interpolitécnico de fútbol (ejemplo)', 'Convocatoria para equipos representativos de nivel superior.', 'convocatoria', 'vigente', 'https://www.ipn.mx/deportes/convocatorias/convocatorias-2026.html', TRUE),
 (1, 'Carrera atlética 5 km (ejemplo)', 'Carrera abierta a la comunidad politécnica.', 'convocatoria', 'cerrada', 'https://www.ipn.mx/deportes/convocatorias/convocatorias-2026.html', FALSE);

INSERT INTO actividad (id_oportunidad, nivel_deportivo, cupo, costo) VALUES
 (1, 'Todos los niveles', 30, 0),
 (2, 'Principiante / intermedio', 20, 0),
 (3, 'Representativo', 25, 0),
 (4, 'Todos los niveles', NULL, 0),
 (5, 'Recreativo', NULL, 0);

INSERT INTO beca (id_oportunidad, monto, beneficios, periodo) VALUES
 (6, NULL, 'Apoyo económico; ver convocatoria oficial', 'Ver convocatoria oficial'),
 (7, NULL, 'Apoyo económico; ver convocatoria oficial', 'Ver convocatoria oficial');

INSERT INTO convocatoria (id_oportunidad, evento, fecha_apertura, fecha_cierre, url_inscripcion) VALUES
 (8, 'Torneo interpolitécnico', '2026-11-01', '2026-12-15', 'https://www.ipn.mx/deportes/convocatorias/convocatorias-2026.html'),
 (9, 'Carrera 5 km', '2026-08-01', '2026-09-15', NULL);

INSERT INTO oportunidad_unidad (id_oportunidad, id_unidad) VALUES
 (1,1),(2,1),(3,6),(4,4),(5,2),(5,3),
 (6,1),(6,2),(6,3),(6,4),(6,5),(6,6),
 (7,1),(7,2),(7,3),(7,4),(7,5),(7,6),
 (8,1),(8,2),(8,3),(8,4),(8,5),(8,6),
 (9,1),(9,2),(9,3),(9,4),(9,5),(9,6);

INSERT INTO oportunidad_disciplina (id_oportunidad, id_disciplina) VALUES
 (1,2),(2,6),(3,1),(4,7),(5,3),(8,1),(9,4);

INSERT INTO horario (id_oportunidad, id_sede, dia_semana, hora_inicio, hora_fin) VALUES
 (1,1,1,'13:00','15:00'),(1,1,3,'13:00','15:00'),(1,1,5,'13:00','15:00'),
 (2,2,2,'16:00','17:30'),(2,2,4,'16:00','17:30'),
 (3,6,1,'07:00','09:00'),(3,6,3,'07:00','09:00'),(3,6,5,'07:00','09:00'),
 (4,5,3,'15:00','17:00'),
 (5,4,2,'12:00','14:00'),(5,4,4,'12:00','14:00');

INSERT INTO requisito (id_oportunidad, descripcion, obligatorio) VALUES
 (1, 'Credencial vigente del IPN', TRUE),
 (1, 'Certificado médico', FALSE),
 (2, 'Credencial vigente del IPN', TRUE),
 (2, 'Ropa deportiva', TRUE),
 (3, 'Credencial vigente del IPN', TRUE),
 (3, 'Certificado médico', TRUE),
 (4, 'Credencial vigente del IPN', TRUE),
 (6, 'Ser estudiante inscrito del IPN', TRUE),
 (6, 'Los demás requisitos de la convocatoria oficial', TRUE),
 (7, 'Ser estudiante inscrito del IPN', TRUE),
 (7, 'Los demás requisitos de la convocatoria oficial', TRUE),
 (8, 'Registro del equipo por la unidad académica', TRUE);

INSERT INTO fuente (id_oportunidad, nombre, url, tipo_fuente) VALUES
 (1, 'ESCOM. Actividades deportivas', 'https://www.escom.ipn.mx/SSEIS/serviciosestudiantiles/servicios/actsDeportivas.php', 'portal'),
 (2, 'ESCOM. Actividades deportivas', 'https://www.escom.ipn.mx/SSEIS/serviciosestudiantiles/servicios/actsDeportivas.php', 'portal'),
 (3, 'IPN. Dirección de Actividades Deportivas', 'https://www.ipn.mx/deportes/', 'portal'),
 (4, 'IPN. Dirección de Actividades Deportivas', 'https://www.ipn.mx/deportes/', 'portal'),
 (5, 'IPN. Dirección de Actividades Deportivas', 'https://www.ipn.mx/deportes/', 'portal'),
 (6, 'IPN. Dirección de Apoyos a Estudiantes. Becas', 'https://www.ipn.mx/daes/servicios/becas/', 'portal'),
 (7, 'IPN. Dirección de Apoyos a Estudiantes. Becas', 'https://www.ipn.mx/daes/servicios/becas/', 'portal'),
 (8, 'IPN. Convocatorias deportivas 2026', 'https://www.ipn.mx/deportes/convocatorias/convocatorias-2026.html', 'convocatoria'),
 (9, 'IPN. Convocatorias deportivas 2026', 'https://www.ipn.mx/deportes/convocatorias/convocatorias-2026.html', 'convocatoria');

INSERT INTO rol (nombre, descripcion) VALUES
 ('estudiante',    'Consulta, guarda y reporta oportunidades'),
 ('administrador', 'Captura, edita y verifica oportunidades; atiende reportes');
