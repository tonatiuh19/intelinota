-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Mar 08, 2026 at 09:03 PM
-- Server version: 5.7.23-23
-- PHP Version: 8.1.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `intelinota`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_login_codes`
--

CREATE TABLE `admin_login_codes` (
  `id` int(10) UNSIGNED NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `used` tinyint(1) NOT NULL DEFAULT '0',
  `ip_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SHA-256 of requester IP for rate-limit auditing',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Short-lived OTP codes for admin/author email login';

--
-- Dumping data for table `admin_login_codes`
--

INSERT INTO `admin_login_codes` (`id`, `email`, `code`, `expires_at`, `used`, `ip_hash`, `created_at`) VALUES
(3, 'axgoomez@gmail.com', '668068', '2026-03-07 18:40:23', 1, 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', '2026-03-07 18:39:58');

-- --------------------------------------------------------

--
-- Table structure for table `articles`
--

CREATE TABLE `articles` (
  `id` int(10) UNSIGNED NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `excerpt` text COLLATE utf8mb4_unicode_ci,
  `content` longtext COLLATE utf8mb4_unicode_ci,
  `category_id` int(10) UNSIGNED NOT NULL,
  `subcategory_id` int(10) UNSIGNED DEFAULT NULL,
  `author_id` int(10) UNSIGNED NOT NULL,
  `image_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `read_time_minutes` smallint(5) UNSIGNED NOT NULL DEFAULT '5',
  `featured` tinyint(1) NOT NULL DEFAULT '0',
  `trending` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('draft','in_review','published','archived','scheduled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `published_at` timestamp NULL DEFAULT NULL,
  `view_count` int(10) UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `meta_title` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_description` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `articles`
--

INSERT INTO `articles` (`id`, `slug`, `title`, `excerpt`, `content`, `category_id`, `subcategory_id`, `author_id`, `image_url`, `read_time_minutes`, `featured`, `trending`, `status`, `published_at`, `view_count`, `created_at`, `updated_at`) VALUES
(1, 'futuro-ia-mas-alla-grandes-modelos-lenguaje', 'El Futuro de la IA: Más allá de los Grandes Modelos de Lenguaje', 'A medida que los LLM alcanzan su meseta, los investigadores exploran la IA neuro-simbólica como la próxima frontera para el razonamiento auténtico.', NULL, 1, 1, 1, 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000', 8, 1, 1, 'published', '2024-05-24 15:00:00', 2, '2026-03-07 04:23:57', '2026-03-07 19:08:04'),
(2, 'final-champions-league-previa-tactica', 'Final de la Champions League: Previa Táctica', 'Un análisis profundo de las estrategias de los dos gigantes que se enfrentarán en Wembley. ¿Quién dominará el mediocampo?', NULL, 2, 4, 2, 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1000', 6, 1, 1, 'published', '2024-05-23 15:00:00', 5, '2026-03-07 04:23:57', '2026-03-09 00:47:07'),
(3, 'juego-indie-ano-ascenso-nebula', 'Juego Indie del Año: El Ascenso de \'Nebula\'', 'Cómo un equipo de tres desarrolladores creó una obra maestra que desafía a los gigantes AAA en narrativa y mecánicas.', NULL, 4, 10, 3, 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1000', 10, 1, 0, 'published', '2024-05-22 15:00:00', 1, '2026-03-07 04:23:57', '2026-03-07 19:01:12'),
(4, 'regreso-del-cine-imax-ganando', 'El Regreso del Cine: Por qué IMAX está Ganando', 'Los cines están evolucionando. Exploramos cómo los formatos premium están devolviendo al público a la gran pantalla.', NULL, 3, 7, 4, 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1000', 5, 1, 0, 'published', '2024-05-21 15:00:00', 3, '2026-03-07 04:23:57', '2026-03-07 18:43:18'),
(5, 'economia-global-2024-navegando-inflacion', 'Economía Global 2024: Navegando la Inflación', 'Los bancos centrales caminan por la cuerda floja. Lo que significan los últimos datos para tus inversiones y vida diaria.', NULL, 5, 13, 5, 'https://images.unsplash.com/photo-1611974714014-4986423b9f36?auto=format&fit=crop&q=80&w=1000', 12, 0, 1, 'published', '2024-05-20 15:00:00', 2, '2026-03-07 04:23:57', '2026-03-09 02:52:35'),
(6, 'explorando-abismo-descubrimientos-fosa-marianas', 'Explorando el Abismo: Nuevos Descubrimientos en la Fosa de las Marianas', 'Científicos descubren cinco nuevas especies de criaturas bioluminiscentes en las partes más oscuras del océano.', NULL, 5, 14, 6, 'https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&q=80&w=1000', 15, 0, 0, 'published', '2024-05-19 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(7, 'dominando-metaverso-guia-principiantes', 'Dominando el Metaverso: Guía para Principiantes', 'Todo lo que necesitas saber sobre la próxima iteración de internet y cómo empezar hoy mismo.', NULL, 1, 2, 7, 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=1000', 7, 0, 0, 'published', '2024-05-18 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(8, 'evolucion-esports-sotanos-estadios', 'La Evolución de los Esports: De Sótanos a Estadios', 'Cómo el gaming competitivo se transformó en una industria multimillonaria con reconocimiento global.', NULL, 4, 11, 8, 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&q=80&w=1000', 9, 0, 0, 'published', '2024-05-17 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(9, 'arte-narrar-historias-series-tv-modernas', 'El Arte de Narrar Historias en las Series de TV Modernas', 'Por qué la actual \'Edad de Oro de la Televisión\' está redefiniendo el consumo de narrativas de formato largo.', NULL, 3, 8, 9, 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&q=80&w=1000', 11, 0, 0, 'published', '2024-05-16 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(10, 'revolucion-tenis-nueva-generacion-toma-mando', 'Revolución en el Tenis: La Nueva Generación Toma el Mando', 'Cómo las jóvenes estrellas están rompiendo la dominación del Big Three y cambiando la cara del deporte.', NULL, 2, 5, 10, 'https://images.unsplash.com/photo-1595435066373-67856e4c274b?auto=format&fit=crop&q=80&w=1000', 8, 0, 0, 'published', '2024-05-15 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(11, 'por-que-para-chivas-el-clasico-contra-atlas-puede-ser-mas-importante-que-contra-america', '¿Por qué para Chivas el clásico contra Atlas puede ser más importante que contra América?', 'Por qué para muchos aficionados de Chivas el Clásico Tapatío contra Atlas se vive con más intensidad que el Clásico Nacional frente al América.', NULL, 2, 4, 8, 'https://eliasarriazola.wordpress.com/wp-content/uploads/2014/03/chivas-aficion.jpg?w=1100', 3, 1, 1, 'published', '2026-03-09 08:52:00', 1, '2026-03-09 02:52:35', '2026-03-09 03:02:02');

-- --------------------------------------------------------

--
-- Table structure for table `article_blocks`
--

CREATE TABLE `article_blocks` (
  `id` int(10) UNSIGNED NOT NULL,
  `article_id` int(10) UNSIGNED NOT NULL,
  `position` smallint(5) UNSIGNED NOT NULL DEFAULT '0',
  `type` enum('html','image','youtube','twitter','instagram','quote','divider') COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `article_blocks`
--

INSERT INTO `article_blocks` (`id`, `article_id`, `position`, `type`, `data`, `created_at`) VALUES
(1, 1, 1, 'html', '{\"html\": \"<p>La inteligencia artificial ha recorrido un largo camino desde los primeros días de las redes neuronales simples. Hoy, los grandes modelos de lenguaje como GPT-4 y Gemini Ultra dominan los titulares, pero en los laboratorios más avanzados del mundo una nueva generación de sistemas está tomando forma: la IA neuro-simbólica.</p>\"}', '2026-03-07 04:23:57'),
(2, 1, 2, 'image', '{\"alt\": \"Visualización de red neuronal avanzada\", \"url\": \"https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"Redes neuronales neuro-simbólicas visualizadas en 3D\"}', '2026-03-07 04:23:57'),
(3, 1, 3, 'quote', '{\"text\": \"Los LLM son increíblemente poderosos, pero todavía no razonan. Un sistema neuro-simbólico puede aprender Y razonar simultáneamente.\", \"attribution\": \"Dr. Gary Marcus, NYU\"}', '2026-03-07 04:23:57'),
(4, 1, 4, 'html', '{\"html\": \"<h2>El Problema con los LLM Actuales</h2><p>Los modelos de lenguaje grandes han demostrado capacidades impresionantes en la generación de texto, código y creatividad. Sin embargo, su talón de Aquiles sigue siendo el razonamiento genuino. Los transformers son esencialmente máquinas de predicción estadística: aprenden patrones en los datos, pero no construyen modelos del mundo que puedan usarse para el razonamiento causal.</p><h2>La IA Neuro-Simbólica: Lo Mejor de Dos Mundos</h2><p>Proyectos como AlphaGeometry de DeepMind, que resolvió problemas olímpicos de geometría, o el sistema DreamCoder del MIT, usan enfoques híbridos que van más allá de la pura predicción estadística. La IA neuro-simbólica combina el aprendizaje profundo con la lógica formal.</p>\"}', '2026-03-07 04:23:57'),
(5, 1, 5, 'youtube', '{\"caption\": \"¿Cómo funcionan realmente las redes neuronales? Una explicación visual completa.\", \"video_id\": \"aircAruvnKk\"}', '2026-03-07 04:23:57'),
(6, 1, 6, 'quote', '{\"text\": \"Este no es el fin de los LLM, sino el comienzo de la siguiente fase. Los modelos futuros serán neuro-simbólicos por defecto.\", \"attribution\": \"Elena Vance\"}', '2026-03-07 04:23:57'),
(7, 2, 1, 'html', '{\"html\": \"<p>La final de la UEFA Champions League siempre ha sido el escenario donde los grandes estrategas del fútbol mundial se enfrentan. Este año, las semifinales nos dejaron dos equipos con filosofías tácticas radicalmente distintas, lo que promete un espectáculo de ajedrez futbolístico en Wembley.</p>\"}', '2026-03-07 04:23:57'),
(8, 2, 2, 'image', '{\"alt\": \"Estadio de fútbol iluminado en la noche\", \"url\": \"https://images.unsplash.com/photo-1551958219-acbc595b151e?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"La noche de gala futbolística más esperada del año llega a Wembley\"}', '2026-03-07 04:23:57'),
(9, 2, 3, 'html', '{\"html\": \"<h2>El Duelo de Mediocampos</h2><p>El centro del campo será decisivo. Un equipo propone dominar la posesión con un doble pivote de recuperación, mientras el otro apuesta por un centrocampista box-to-box que conecte defensa y ataque.</p><p><strong>Claves tácticas a observar:</strong></p><ul><li>Presión tras pérdida en campo rival</li><li>Uso de los carriles interiores de los extremos</li><li>Línea defensiva alta vs. bloque medio</li><li>Transiciones rápidas en los primeros 15 metros</li></ul>\"}', '2026-03-07 04:23:57'),
(10, 2, 4, 'twitter', '{\"tweet_id\": \"1793865432198765056\", \"tweet_url\": \"https://twitter.com/ChampionsLeague/status/1793865432198765056\"}', '2026-03-07 04:23:57'),
(11, 2, 5, 'html', '{\"html\": \"<h2>Hombres Clave</h2><p>En el último tercio decisivo, todo apunta a un duelo individual fascinante. Las estadísticas de pressing y recuperación del mediocampo en esta edición del torneo no mienten: quien gane ese duelo, ganará el partido.</p>\"}', '2026-03-07 04:23:57'),
(12, 3, 1, 'html', '{\"html\": \"<p>Cuando <em>Nebula</em> llegó al mercado sin previo aviso, nadie esperaba que un estudio de tres personas pudiera sacudir los cimientos de la industria del videojuego. Seis meses después, el juego ha vendido más de 4 millones de copias y ganado más de 40 premios Game of the Year.</p>\"}', '2026-03-07 04:23:57'),
(13, 3, 2, 'youtube', '{\"caption\": \"Tráiler oficial de Nebula — el juego indie que lo cambió todo\", \"video_id\": \"Yqfhu3jH0Q0\"}', '2026-03-07 04:23:57'),
(14, 3, 3, 'html', '{\"html\": \"<h2>Una Historia que Te Atrapa</h2><p>Nebula sigue a una astrónoma que descubre que el universo está colapsando, pero solo ella puede verlo. La mecánica principal —recomponer constelaciones para restaurar el tejido del espacio-tiempo— se integra perfectamente con la narrativa emocional del juego. Lo que diferencia a Nebula no es solo su jugabilidad, sino cómo cada mecánica cuenta parte de la historia.</p>\"}', '2026-03-07 04:23:57'),
(15, 3, 4, 'image', '{\"alt\": \"Galaxia espiral colorida\", \"url\": \"https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"El universo de Nebula es tan vasto como hermoso\"}', '2026-03-07 04:23:57'),
(16, 3, 5, 'quote', '{\"text\": \"Queríamos hacer el juego que nosotros queríamos jugar. Nunca pensamos que le gustaría a alguien más.\", \"attribution\": \"Kai Tanaka, Director Creativo de Nebula\"}', '2026-03-07 04:23:57'),
(17, 3, 6, 'html', '{\"html\": \"<h2>El Veredicto</h2><p>Nebula es una obra maestra. No por su presupuesto o su escala, sino por su claridad de visión. Es la prueba definitiva de que las mejores ideas en videojuegos no requieren cientos de millones de dólares, solo pasión y genialidad creativa.</p><p><strong>Puntuación: 10/10</strong></p>\"}', '2026-03-07 04:23:57'),
(18, 4, 1, 'html', '{\"html\": \"<p>Tras años de declive acelerado por el streaming, los cines están protagonizando un regreso inesperado. El secreto: la experiencia inmersiva que ninguna pantalla doméstica puede replicar. Y en el centro de esta revolución está el formato IMAX.</p>\"}', '2026-03-07 04:23:57'),
(19, 4, 2, 'image', '{\"alt\": \"Interior de sala de cine IMAX\", \"url\": \"https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"Las pantallas IMAX superan los 23 metros de altura\"}', '2026-03-07 04:23:57'),
(20, 4, 3, 'html', '{\"html\": \"<h2>Los Números No Mienten</h2><p>Las salas IMAX generan el 25% de los ingresos de taquilla globales a pesar de representar menos del 2% de las pantallas totales. En el último año, cada butaca IMAX generó en promedio 8 veces más ingresos que una convencional.</p>\"}', '2026-03-07 04:23:57'),
(21, 4, 4, 'youtube', '{\"caption\": \"Así se filma una película en formato IMAX — detrás de cámaras\", \"video_id\": \"Dc6QZ04yGDA\"}', '2026-03-07 04:23:57'),
(22, 4, 5, 'quote', '{\"text\": \"Ver una película en IMAX no es solo verla más grande. Es sentirte dentro de ella.\", \"attribution\": \"Christopher Nolan, Director\"}', '2026-03-07 04:23:57'),
(23, 4, 6, 'html', '{\"html\": \"<h2>El Futuro del Cine Es Premium</h2><p>La batalla no es entre cines y streaming. Es entre experiencias memorables y consumo pasivo. Y en esa batalla, IMAX lleva una ventaja que ningún televisor, por caro que sea, puede eliminar.</p>\"}', '2026-03-07 04:23:57'),
(24, 5, 1, 'html', '{\"html\": \"<p>El mundo económico de 2024 se parece a un malabarista con demasiadas pelotas en el aire. La inflación, aunque cediendo lentamente, sigue siendo el enemigo número uno de los bancos centrales. Mientras tanto, el mercado laboral se niega a enfriarse y los mercados financieros ignoran todas las señales de advertencia.</p>\"}', '2026-03-07 04:23:57'),
(25, 5, 2, 'image', '{\"alt\": \"Pantallas con gráficos financieros\", \"url\": \"https://images.unsplash.com/photo-1543286386-713bdd548da4?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"Los mercados financieros globales reflejan la incertidumbre del momento\"}', '2026-03-07 04:23:57'),
(26, 5, 3, 'quote', '{\"text\": \"Los bancos centrales se enfrentan a la misma disyuntiva de siempre: matar la inflación o proteger el empleo. Esta vez, ambos objetivos están directamente en conflicto.\", \"attribution\": \"Christine Lagarde, Presidenta del BCE\"}', '2026-03-07 04:23:57'),
(27, 5, 4, 'html', '{\"html\": \"<h2>Qué Significa Para Tu Bolsillo</h2><p>Si tienes una hipoteca variable, los próximos 12 meses serán los más decisivos de la última década. La curva de tipos sugiere una primera bajada para finales de año, pero los analistas advierten que podría ser temporal.</p><p>Para los inversores, la diversificación geográfica nunca ha sido más importante. Los mercados de Asia emergente ofrecen valoraciones atractivas que los mercados occidentales perdieron hace tiempo.</p>\"}', '2026-03-07 04:23:57'),
(28, 6, 1, 'html', '{\"html\": \"<p>A once kilómetros bajo la superficie del Pacífico, donde la presión aplasta el acero y la oscuridad es absoluta, la vida encuentra un camino. La más reciente expedición a la Fosa de las Marianas ha regresado con descubrimientos que reescriben nuestra comprensión de los límites de la biología.</p>\"}', '2026-03-07 04:23:57'),
(29, 6, 2, 'image', '{\"alt\": \"Criatura bioluminiscente en las profundidades del océano\", \"url\": \"https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"Las profundidades oceánicas albergan formas de vida que desafían la imaginación\"}', '2026-03-07 04:23:57'),
(30, 6, 3, 'youtube', '{\"caption\": \"Imágenes inéditas de las cinco nuevas especies capturadas por los ROVs de la expedición\", \"video_id\": \"UKUQnwbkB04\"}', '2026-03-07 04:23:57'),
(31, 6, 4, 'html', '{\"html\": \"<h2>Las Cinco Nuevas Especies</h2><ul><li><strong>Amphipoda luminaris</strong>: Crustáceo bioluminiscente de 12cm con cinco pares de fotóforos autónomos</li><li><strong>Polychaeta abyssalis</strong>: Gusano marino con capacidad de producir su propio calor metabólico</li><li><strong>Holothuroidea profunda</strong>: Pepino de mar translúcido que se alimenta de partículas de grafeno natural</li><li><strong>Cnidaria spectris</strong>: Medusa capaz de emitir luz ultravioleta visible en cámaras estándar</li><li><strong>Bactria hadalis</strong>: Bacteria capaz de metabolizar plástico PET a presiones extremas</li></ul>\"}', '2026-03-07 04:23:57'),
(32, 6, 5, 'quote', '{\"text\": \"Esta última especie bacteriana es posiblemente el descubrimiento más importante. Si podemos entender cómo metaboliza el plástico a esas presiones, podría revolucionar la remediación oceánica.\", \"attribution\": \"Dra. Amy Johnson, Instituto Scripps\"}', '2026-03-07 04:23:57'),
(33, 7, 1, 'html', '{\"html\": \"<p>El metaverso lleva años prometiendo ser la próxima gran revolución de internet. Tras el hype de 2021-2022 y la subsiguiente resaca, 2024 está mostrando señales de que el concepto —despojado de sus excesos especulativos— tiene bases sólidas.</p>\"}', '2026-03-07 04:23:57'),
(34, 7, 2, 'image', '{\"alt\": \"Persona usando gafas de realidad virtual\", \"url\": \"https://images.unsplash.com/photo-1617802690992-15d93263d3a9?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"Las gafas de realidad mixta son la puerta de entrada al metaverso moderno\"}', '2026-03-07 04:23:57'),
(35, 7, 3, 'html', '{\"html\": \"<h2>Por Dónde Empezar</h2><p>Para un principiante, el primer paso no requiere hardware especial. Plataformas como Decentraland o el emergente ecosistema de Spatial ofrecen experiencias accesibles desde cualquier navegador.</p>\"}', '2026-03-07 04:23:57'),
(36, 7, 4, 'youtube', '{\"caption\": \"Metaverso en 2024: qué es real y qué es todavía promesa\", \"video_id\": \"DEzAEkQNDkM\"}', '2026-03-07 04:23:57'),
(37, 7, 5, 'html', '{\"html\": \"<h2>El Metaverso en el Trabajo</h2><p>Donde el metaverso está ganando más terreno real no es en el entretenimiento, sino en sectores industriales. Boeing usa gemelos digitales en entornos 3D inmersivos para diseñar aviones. Varios hospitales europeos entrenan cirujanos en quirófanos virtuales.</p>\"}', '2026-03-07 04:23:57'),
(38, 8, 1, 'html', '{\"html\": \"<p>Hay una fotografía de 1998 que muestra a seis adolescentes surcoreanos amontonados en un PC bang de Seúl, jugando StarCraft hasta las 4 de la mañana. Uno de ellos se convertiría en el primer millonario profesional de los esports. Hoy, la industria genera más de 1.800 millones de dólares anuales.</p>\"}', '2026-03-07 04:23:57'),
(39, 8, 2, 'image', '{\"alt\": \"Estadio lleno para un torneo de esports\", \"url\": \"https://images.unsplash.com/photo-1587095951604-b9d924a3fda0?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"El Staples Center de Los Ángeles acogió el mundial de League of Legends ante 20.000 espectadores\"}', '2026-03-07 04:23:57'),
(40, 8, 3, 'twitter', '{\"tweet_id\": \"1791234567890123456\", \"tweet_url\": \"https://twitter.com/ESL_CSGO/status/1791234567890123456\"}', '2026-03-07 04:23:57'),
(41, 8, 4, 'youtube', '{\"caption\": \"La final del Mundial de League of Legends 2023 — el momento que paró el mundo\", \"video_id\": \"bgU7FeiWKzc\"}', '2026-03-07 04:23:57'),
(42, 8, 5, 'html', '{\"html\": \"<h2>El Negocio Detrás de los Píxeles</h2><p>Red Bull, Mercedes-Benz, Louis Vuitton, Samsung — las marcas de lujo y gran consumo han descubierto en los esports un canal incomparable para llegar a la Generación Z. Los acuerdos de patrocinio crecieron un 18% en 2023.</p>\"}', '2026-03-07 04:23:57'),
(43, 9, 1, 'html', '{\"html\": \"<p>Dicen que vivimos en la Edad de Oro de la televisión. Pero si eso es cierto, ¿cuándo empezó exactamente? ¿Con The Sopranos en 1999? ¿Con Breaking Bad? ¿O es ahora, con la proliferación de plataformas que han convertido cada nicho cultural en una oportunidad narrativa?</p>\"}', '2026-03-07 04:23:57'),
(44, 9, 2, 'image', '{\"alt\": \"Persona viendo streaming en portátil\", \"url\": \"https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"El consumo en maratón cambió para siempre la forma de escribir series\"}', '2026-03-07 04:23:57'),
(45, 9, 3, 'quote', '{\"text\": \"El formato largo ya no es un compromiso, es la herramienta narrativa más potente que existe. Ninguna película puede hacer lo que hace una segunda temporada bien escrita.\", \"attribution\": \"Shonda Rhimes, Showrunner\"}', '2026-03-07 04:23:57'),
(46, 9, 4, 'html', '{\"html\": \"<h2>El Binge-Watching Reimaginado</h2><p>Las plataformas que un día apostaron por lanzar temporadas completas de golpe están dando marcha atrás. El modelo semanal de HBO ha demostrado ser más eficaz en términos de conversación cultural, engagement y retención de suscriptores. La espera crea anticipación, y la anticipación crea comunidad.</p>\"}', '2026-03-07 04:23:57'),
(47, 10, 1, 'html', '{\"html\": \"<p>Durante casi dos décadas, el tenis profesional estuvo dominado por tres figuras de proporciones míticas: Federer, Nadal y Djokovic. El Big Three no era solo una estadística; era un estado mental que le decía al resto: llegaste demasiado tarde. Pero en 2024, la historia está cambiando.</p>\"}', '2026-03-07 04:23:57'),
(48, 10, 2, 'image', '{\"alt\": \"Tenista joven en acción durante un partido\", \"url\": \"https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&q=80&w=1400\", \"credit\": \"Unsplash\", \"caption\": \"La nueva generación del tenis ha llegado para quedarse\"}', '2026-03-07 04:23:57'),
(49, 10, 3, 'html', '{\"html\": \"<h2>Los Nombres del Futuro</h2><p>Carlos Alcaraz ya no es una promesa; es una realidad. Con dos Grand Slams conquistados antes de los 21 años, el murciano ha demostrado tener el juego completo para dominar el deporte durante la próxima década. Jannik Sinner, Holger Rune y Félix Auger-Aliassime completan un cuarteto generacional sin precedentes en cuanto a densidad de talento.</p>\"}', '2026-03-07 04:23:57'),
(50, 10, 4, 'twitter', '{\"tweet_id\": \"1792345678901234567\", \"tweet_url\": \"https://twitter.com/atptour/status/1792345678901234567\"}', '2026-03-07 04:23:57'),
(51, 10, 5, 'quote', '{\"text\": \"Nunca había visto tanta calidad junta en una misma generación. Y lo mejor es que aún les queda mucho por mejorar.\", \"attribution\": \"John McEnroe, Comentarista\"}', '2026-03-07 04:23:57'),
(52, 11, 1, 'html', '{\"html\": \"<h2>La noche que Guadalajara volvió a pintarse de rojiblanco</h2><p></p>\"}', '2026-03-09 02:52:35'),
(53, 11, 2, 'html', '{\"html\": \"<p>La noche del 7 de marzo de 2026, el Chivas de Guadalajara volvió a demostrar por qué el orgullo de la ciudad pesa tanto en este enfrentamiento. En el Estadio Jalisco, el Rebaño remontó el partido y derrotó 2-1 al Atlas Fútbol Club con goles de Armando González y Ángel Sepúlveda, llevándose una edición más del histórico Clásico Tapatío.</p><p>El triunfo no solo significó tres puntos en el torneo Clausura 2026. También añadió otro capítulo a una rivalidad que lleva más de un siglo escribiéndose en Guadalajara. El enfrentamiento entre rojiblancos y rojinegros se disputó por centésima vez dentro de una larga historia de clásicos que comenzó en 1916, consolidándose como una de las rivalidades más antiguas del fútbol mexicano.<br></p><p>Y es precisamente ahí donde surge una pregunta interesante dentro de la cultura futbolera: ¿por qué para muchos aficionados de Chivas el clásico contra Atlas puede sentirse incluso más importante que el partido contra el América?<br></p><p>Para entenderlo, hay que mirar más allá de los títulos, la televisión y la rivalidad nacional. Hay que mirar a Guadalajara, a sus barrios, a sus familias y a una rivalidad que se vive todos los días, no solo cuando rueda el balón.</p>\"}', '2026-03-09 02:52:35'),
(54, 11, 3, 'html', '{\"html\": \"<h2>El Clásico que divide Guadalajara: por qué para Chivas el Atlas pesa más que el América</h2><p></p>\"}', '2026-03-09 02:52:35'),
(55, 11, 4, 'html', '{\"html\": \"<p>En el fútbol mexicano existe una rivalidad que domina titulares, ratings y debates en todo el país: el enfrentamiento entre <strong>Chivas de Guadalajara</strong> y <strong>Club América</strong>, conocido como el <strong>Clásico Nacional</strong>. Sin embargo, para muchos aficionados rojiblancos hay un partido que se vive con una intensidad distinta, más íntima y emocional: el duelo contra <strong>Atlas Fútbol Club</strong>, el histórico <strong>Clásico Tapatío</strong>.<br></p><p>Aunque el América representa el rival más mediático del país, el Atlas representa algo aún más profundo para la afición de Chivas: el orgullo de Guadalajara.</p>\"}', '2026-03-09 02:52:35'),
(56, 11, 5, 'html', '{\"html\": \"<h3>Una rivalidad que nació en la misma ciudad</h3><p></p>\"}', '2026-03-09 02:52:35'),
(57, 11, 6, 'image', '{\"alt\": \"\", \"url\": \"https://www.informador.mx/export/sites/elinformador/img/2019/02/14/imagen_06_diciembre_2019.jpg_320310160.jpg\", \"credit\": \"El Informador\", \"caption\": \"En 1943, el año de la creación de la Liga mexicana, el encono entre rojiblancos y rojinegros ya estaba consolidado.\"}', '2026-03-09 02:52:35'),
(58, 11, 7, 'html', '{\"html\": \"<p>La diferencia clave entre los dos clásicos radica en la convivencia cotidiana. El América es un rival nacional, pero para los aficionados de Chivas en Guadalajara <strong>no es un rival con el que convivan diariamente</strong>.</p><p>En cambio, los aficionados del Atlas forman parte de la misma comunidad. Eso significa que cada derrota puede convertirse en motivo de bromas, debates y rivalidad directa durante meses.<br></p><p>En ese contexto, ganar el Clásico Tapatío no solo suma tres puntos: <strong>significa demostrar quién manda en la ciudad</strong>.</p><h3>Identidad y tradición<br></h3><p>Históricamente, ambos clubes también han representado identidades distintas dentro de Guadalajara. Chivas se consolidó como un equipo popular con una identidad profundamente mexicana, mientras que Atlas desarrolló una reputación ligada a la formación de talento y una tradición futbolística más académica.</p><p>Estas diferencias alimentaron la rivalidad durante más de un siglo, convirtiendo el Clásico Tapatío en una de las rivalidades más arraigadas del fútbol mexicano.</p><h3>El Clásico Nacional: grandeza contra grandeza<br></h3><p>Esto no significa que el enfrentamiento contra el América pierda importancia. El duelo entre Chivas y América representa algo diferente: una rivalidad de alcance nacional entre dos de los clubes más populares y exitosos del país. El Clásico Nacional es un espectáculo mediático, seguido por millones de aficionados y cargado de historia en finales, liguillas y polémicas.<br></p><p>Sin embargo, mientras ese clásico representa poder y grandeza en el fútbol mexicano, el enfrentamiento contra Atlas representa algo más cercano: <strong>la identidad de Guadalajara</strong>.</p><h3>Dos clásicos, dos emociones</h3><p>Para la afición rojiblanca, ambos partidos tienen un valor especial, pero por razones distintas.<br></p><p>El Clásico Nacional se vive con orgullo nacional y rivalidad histórica entre gigantes del fútbol mexicano. El Clásico Tapatío, en cambio, se vive con el corazón de la ciudad.</p><p>Por eso muchos aficionados de Chivas repiten una frase que resume perfectamente este sentimiento:</p>\"}', '2026-03-09 02:52:35'),
(59, 11, 8, 'quote', '{\"text\": \"Al América hay que ganarle… pero al Atlas no se le puede perder.\", \"attribution\": \"\"}', '2026-03-09 02:52:35');

-- --------------------------------------------------------

--
-- Table structure for table `article_tags`
--

CREATE TABLE `article_tags` (
  `article_id` int(10) UNSIGNED NOT NULL,
  `tag_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `article_revisions`
--

CREATE TABLE `article_revisions` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `snapshot` json NOT NULL COMMENT 'Article fields + blocks at save time',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `kind` enum('snapshot','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'snapshot',
  `review_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_by` int(10) UNSIGNED DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_revisions_article_created` (`article_id`, `created_at`),
  KEY `idx_revisions_kind_review` (`kind`, `review_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Newsroom workflow tables (migrations 20261126_*)
-- Migration: editorial review feedback notes
-- Date: 2026-11-26 12:02:00
CREATE TABLE `article_review_notes` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` int(10) UNSIGNED NOT NULL,
  `revision_id` int(10) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `action` enum('returned','approved','published','comment') COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_review_notes_article` (`article_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration: in-app notifications for admin/author users
-- Date: 2026-11-26 12:03:00
CREATE TABLE `notifications` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(10) UNSIGNED NOT NULL,
  `type` varchar(48) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `link` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read` (`user_id`, `read_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration: keep old slugs of published articles resolvable (301)
-- Date: 2026-11-26 12:05:00
CREATE TABLE `article_slug_redirects` (
  `old_slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `article_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`old_slug`),
  KEY `idx_slug_redirects_article` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Remote MCP OAuth + audit (migration 20261126_150000)
-- Intelinota — Remote MCP OAuth 2.1 (Claude / Cursor connectors)
-- TiDB Cloud (MySQL 8.0 compatible). Tables are new: CREATE TABLE only,
-- no ALTERs. Tokens and codes are stored ONLY as sha256 hashes.
-- user_id → users.id (role IN ('admin','author') enforced in code on every request).

CREATE TABLE `mcp_oauth_clients` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` VARCHAR(128) NOT NULL,
  `client_name` VARCHAR(255) DEFAULT NULL,
  `redirect_uris_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mcp_client_id` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mcp_oauth_codes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code_hash` CHAR(64) NOT NULL,
  `client_id` VARCHAR(128) NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `redirect_uri` VARCHAR(1000) NOT NULL,
  `code_challenge` VARCHAR(128) NOT NULL,
  `code_challenge_method` VARCHAR(16) NOT NULL DEFAULT 'S256',
  `scopes` VARCHAR(255) NOT NULL DEFAULT 'intelinota.newsroom',
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mcp_code_hash` (`code_hash`),
  KEY `idx_mcp_codes_user` (`user_id`),
  KEY `idx_mcp_codes_expires` (`expires_at`),
  CONSTRAINT `fk_mcp_codes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mcp_oauth_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_hash` CHAR(64) NOT NULL,
  `refresh_token_hash` CHAR(64) DEFAULT NULL,
  `client_id` VARCHAR(128) NOT NULL,
  `client_name` VARCHAR(255) DEFAULT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `scopes` VARCHAR(255) NOT NULL DEFAULT 'intelinota.newsroom',
  `expires_at` DATETIME NOT NULL COMMENT 'Access token expiry (1h)',
  `refresh_expires_at` DATETIME DEFAULT NULL COMMENT 'Refresh token expiry (30d, rotated on use)',
  `revoked_at` DATETIME DEFAULT NULL,
  `last_used_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mcp_token_hash` (`token_hash`),
  UNIQUE KEY `uq_mcp_refresh_hash` (`refresh_token_hash`),
  KEY `idx_mcp_tokens_user` (`user_id`, `revoked_at`),
  KEY `idx_mcp_tokens_refresh_expires` (`refresh_expires_at`),
  CONSTRAINT `fk_mcp_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mcp_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `client_id` VARCHAR(128) DEFAULT NULL,
  `tool_name` VARCHAR(120) NOT NULL,
  `confirm` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = executed write, 0 = read or dry-run',
  `ok` TINYINT(1) NOT NULL DEFAULT 1,
  `status_code` SMALLINT UNSIGNED DEFAULT NULL,
  `duration_ms` INT UNSIGNED DEFAULT NULL,
  `request_json` JSON DEFAULT NULL COMMENT 'Redacted/truncated args',
  `result_json` JSON DEFAULT NULL COMMENT 'Truncated result',
  `error_message` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mcp_audit_user` (`user_id`, `id`),
  KEY `idx_mcp_audit_tool` (`tool_name`, `created_at`),
  CONSTRAINT `fk_mcp_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `action` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int(10) UNSIGNED DEFAULT NULL,
  `details` json DEFAULT NULL,
  `ip_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_created` (`created_at`),
  KEY `idx_audit_entity` (`entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `authors`
--

CREATE TABLE `authors` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `avatar_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `twitter_handle` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `social_links` json DEFAULT NULL COMMENT 'Social network URLs',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `authors`
--

INSERT INTO `authors` (`id`, `name`, `slug`, `bio`, `avatar_url`, `email`, `twitter_handle`, `created_at`, `updated_at`) VALUES
(1, 'Elena Vance', 'elena-vance', 'Editora de tecnología e inteligencia artificial.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(2, 'Marcus Thorne', 'marcus-thorne', 'Periodista deportivo especializado en fútbol europeo.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(3, 'Sora Kim', 'sora-kim', 'Crítica de videojuegos indie y cultura gamer.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(4, 'Julian Reed', 'julian-reed', 'Crítico cinematográfico y apasionado del formato IMAX.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(5, 'Sarah Jenkins', 'sarah-jenkins', 'Analista económica y corresponsal de mercados globales.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(6, 'David Atten', 'david-atten', 'Periodista científico y divulgador de ciencias naturales.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(7, 'Zoe Chen', 'zoe-chen', 'Especialista en startups, web3 y tecnologías emergentes.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(8, 'Alex Rivers', 'alex-rivers', 'Periodista de esports y cultura competitiva digital.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(9, 'Laura Smith', 'laura-smith', 'Crítica de series de TV y narrativa audiovisual.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(10, 'Pete Sampras', 'pete-sampras', 'Analista de tenis y seguidor de la nueva generación.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56'),
(11, 'Tonatiuh Gomez', 'tonatiuh-gomez', 'Emprendedor tecnológico y creador de productos digitales.', NULL, 'axgoomez@gmail.com', NULL, '2026-03-09 03:00:03', '2026-03-09 03:01:35');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` smallint(5) UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `slug`, `description`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 'Tecnología', 'tecnologia', 'Noticias de tecnología, IA, startups y gadgets', 1, 2, '2026-03-07 04:23:56', '2026-03-07 05:05:50'),
(2, 'Deportes', 'deportes', 'Cobertura de fútbol, tenis, esports y más', 1, 1, '2026-03-07 04:23:56', '2026-03-07 05:05:50'),
(3, 'Cine', 'cine', 'Películas, series de TV y críticas', 1, 4, '2026-03-07 04:23:56', '2026-03-07 05:05:50'),
(4, 'Videojuegos', 'videojuegos', 'Reseñas, esports y cultura gamer', 1, 3, '2026-03-07 04:23:56', '2026-03-07 05:05:50'),
(5, 'Mundo', 'mundo', 'Política, economía y ciencia global', 1, 5, '2026-03-07 04:23:56', '2026-03-07 05:05:50');

-- --------------------------------------------------------

--
-- Table structure for table `comments`
--

CREATE TABLE `comments` (
  `id` int(10) UNSIGNED NOT NULL,
  `article_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `parent_id` int(10) UNSIGNED DEFAULT NULL,
  `author_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','approved','spam') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `spam_score` tinyint(3) UNSIGNED NOT NULL DEFAULT '0',
  `flags` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `media`
--

CREATE TABLE `media` (
  `id` int(10) UNSIGNED NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_data` longblob DEFAULT NULL,
  `storage` enum('db','blob') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'db',
  `variants` json DEFAULT NULL COMMENT 'Array of {width,url} WebP renditions',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size_bytes` int(10) UNSIGNED DEFAULT NULL,
  `width` smallint(5) UNSIGNED DEFAULT NULL,
  `height` smallint(5) UNSIGNED DEFAULT NULL,
  `alt_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `newsletter_subscribers`
--

CREATE TABLE `newsletter_subscribers` (
  `id` int(10) UNSIGNED NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Signup source',
  `status` enum('pending','active','unsubscribed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `confirm_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unsubscribe_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subscribed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `unsubscribed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `setting_type` enum('string','number','boolean','json') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `description` text COLLATE utf8mb4_unicode_ci,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `description`, `updated_at`) VALUES
(1, 'app_version', 'v1.0.0', 'string', 'Current deployed application version shown in the site footer.', CURRENT_TIMESTAMP);

-- --------------------------------------------------------

--
-- Table structure for table `subcategories`
--

CREATE TABLE `subcategories` (
  `id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sort_order` smallint(5) UNSIGNED NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `subcategories`
--

INSERT INTO `subcategories` (`id`, `category_id`, `name`, `slug`, `created_at`) VALUES
(1, 1, 'IA', 'ia', '2026-03-07 04:23:56'),
(2, 1, 'Startups', 'startups', '2026-03-07 04:23:56'),
(3, 1, 'Gadgets', 'gadgets', '2026-03-07 04:23:56'),
(4, 2, 'Fútbol', 'futbol', '2026-03-07 04:23:56'),
(5, 2, 'Tenis', 'tenis', '2026-03-07 04:23:56'),
(6, 2, 'NBA', 'nba', '2026-03-07 04:23:56'),
(7, 3, 'Películas', 'peliculas', '2026-03-07 04:23:56'),
(8, 3, 'Series de TV', 'series-tv', '2026-03-07 04:23:56'),
(9, 3, 'Críticas', 'criticas', '2026-03-07 04:23:56'),
(10, 4, 'Reseñas', 'resenas', '2026-03-07 04:23:56'),
(11, 4, 'Esports', 'esports', '2026-03-07 04:23:56'),
(12, 4, 'Indie', 'indie', '2026-03-07 04:23:56'),
(13, 5, 'Economía', 'economia', '2026-03-07 04:23:56'),
(14, 5, 'Ciencia', 'ciencia', '2026-03-07 04:23:56'),
(15, 5, 'Política', 'politica', '2026-03-07 04:23:56');

-- --------------------------------------------------------

--
-- Table structure for table `tags`
--

CREATE TABLE `tags` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','editor','reader','author') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reader',
  `can_publish` tinyint(1) NOT NULL DEFAULT '0',
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verification_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_token_expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `author_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password_hash`, `name`, `avatar_url`, `role`, `email_verified`, `verification_token`, `reset_token`, `reset_token_expires_at`, `created_at`, `updated_at`, `author_id`) VALUES
(1, 'axgoomez@gmail.com', NULL, 'Alex Gomez', NULL, 'admin', 1, NULL, NULL, NULL, '2026-03-07 06:22:35', '2026-03-09 03:00:04', 11);

-- --------------------------------------------------------

--
-- Table structure for table `visitors`
--

CREATE TABLE `visitors` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Anonymous session ID — UUID sent via X-Session-Id header or server-derived fallback',
  `ip_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SHA-256(raw_ip + VISITORS_SALT env var) — never stores the raw IP address',
  `ip_country` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ISO 3166-1 alpha-2 from CF-IPCountry or x-vercel-ip-country',
  `ip_city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'City name from x-vercel-ip-city (Vercel deployments only)',
  `user_agent` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `browser` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `browser_version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `os` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_type` enum('desktop','mobile','tablet','bot','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `is_bot` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 when UA matches a known bot/crawler pattern',
  `event_type` enum('home_view','article_view','category_view','search','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other',
  `page_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'URL path that was accessed',
  `article_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'FK → articles.id, set for article_view events',
  `category_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'FK → categories.id, set for category_view events',
  `referrer` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Full Referer header value (truncated to 500 chars)',
  `referrer_domain` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Parsed hostname of the referrer',
  `utm_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `utm_medium` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `utm_campaign` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `utm_content` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `utm_term` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'FK → users.id — NULL for anonymous visitors',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Per-request visitor/pageview event log — fire-and-forget inserts, never blocks API responses';

--
-- Dumping data for table `visitors`
--

INSERT INTO `visitors` (`id`, `session_id`, `ip_hash`, `ip_country`, `ip_city`, `user_agent`, `browser`, `browser_version`, `os`, `device_type`, `is_bot`, `event_type`, `page_path`, `article_id`, `category_id`, `referrer`, `referrer_domain`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `user_id`, `created_at`) VALUES
(1, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:14:06'),
(2, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:16:34'),
(3, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:35:07'),
(4, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/final-champions-league-previa-tactica', 2, 2, 'http://localhost:8081/article/final-champions-league-previa-tactica', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:35:21'),
(5, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/article/final-champions-league-previa-tactica', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:35:34'),
(6, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/final-champions-league-previa-tactica', 2, 2, 'http://localhost:8081/article/final-champions-league-previa-tactica', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:35:34'),
(7, '00c9171e0b9ee213954e63ed22332f4460edbd13b2802184055440d899b6a29f', 'b7ebc9c771b4f13e2c89d8709b9aef014c2adda6e38d1ebc8c33c7bebf92a6c8', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-mw81mmrks-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-mw81mmrks-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:43:27'),
(8, '00c9171e0b9ee213954e63ed22332f4460edbd13b2802184055440d899b6a29f', 'b7ebc9c771b4f13e2c89d8709b9aef014c2adda6e38d1ebc8c33c7bebf92a6c8', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-mw81mmrks-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-mw81mmrks-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:43:28'),
(9, 'f613453681e967a392251125a62008b9edca259abf09ea20c654e5fddb23449c', '880dba01efacf467151db0ab045132a630cff041b6d95354f6637333e4ede556', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-3ug7o9ayy-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-3ug7o9ayy-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:44:06'),
(10, '3e9bbd1f8baa658538024984f47275f79d3cb1175b0ebfd05692da3a329864a6', '6f137298f73ab92d1a2fb268f96a9dbcdea1a050573f56b30f888fc5b9579a74', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-3ug7o9ayy-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-3ug7o9ayy-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:44:07'),
(11, '991ff911a0acaea5314be9890f94af8f84737b46ef8639082526d6a96ecef1bb', 'd64424e39e8528d85f9294de0adae4b65be5e6aacac7a7816bc9c15179b1f44f', 'MX', 'Cuauht%C3%A9moc', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota.vercel.app/', 'intelinota.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:44:13'),
(12, '1127528946ddc9324028e1baac556ada2b50a6586414e5342bb1bd61f4d29990', '8296953c55cfc5c2c19e66910a33e5f22ab2f90f047d12b05e8fcb06225865ad', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-l9fspkhlp-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-l9fspkhlp-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:44:35'),
(13, 'ac77b381f160c08597071d57f51d16c6dc03a93e182743812aa3f1d1cc96f01e', 'c64a06382a64bbe2f7af08038e6e904bf915defa970c325aa62fc97ac276a3bb', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-ovux255fx-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-ovux255fx-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:45:44'),
(14, '301bea6bec955594bea709add83b7a1ef52410ed68aea5cff13f6ad8b2fe01ef', '89bcc07db5ef0b84dd6fe37cfdd4f976b19a37582b080fe7cb3482b69a2addf1', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-ovux255fx-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-ovux255fx-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:45:45'),
(15, '77d0fab3aab0efb1e74935b6b586907694b37a81f7b510a41b524406301245b9', 'beedb184c9111317c043dc129b8deef3a7d2ee2a502006ae85994c095d2a02b5', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-fvaj44e56-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-fvaj44e56-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:48:53'),
(16, '4a31ca0432c371302176184a0dfa120bb12c7ba93c6dd7d18506f05f0d0f1db7', 'd3260a277a7f746c1fd61502310c158068c10c15b468787299eb22f4cd1addfe', 'US', 'Santa%20Clara', 'vercel-screenshot/1.0', 'unknown', NULL, 'unknown', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota-fvaj44e56-alex-gomezs-projects-d5136c4b.vercel.app/', 'intelinota-fvaj44e56-alex-gomezs-projects-d5136c4b.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:48:54'),
(17, '991ff911a0acaea5314be9890f94af8f84737b46ef8639082526d6a96ecef1bb', 'd64424e39e8528d85f9294de0adae4b65be5e6aacac7a7816bc9c15179b1f44f', 'MX', 'Cuauht%C3%A9moc', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'https://intelinota.vercel.app/', 'intelinota.vercel.app', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 05:50:51'),
(18, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/article/final-champions-league-previa-tactica', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 06:23:01'),
(19, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 06:38:43'),
(20, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 06:46:21'),
(21, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:02:58'),
(22, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:05:27'),
(23, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:05:45'),
(24, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/final-champions-league-previa-tactica', 2, 2, 'http://localhost:8081/article/final-champions-league-previa-tactica', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:06:00'),
(25, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:22:57'),
(26, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:23:14'),
(27, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:25:40'),
(28, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:37:25'),
(29, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:37:35'),
(30, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:37:45'),
(31, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/economia-global-2024-navegando-inflacion', 5, 5, 'http://localhost:8081/article/economia-global-2024-navegando-inflacion', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:38:02'),
(32, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8081/article/economia-global-2024-navegando-inflacion', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:38:06'),
(33, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/economia-global-2024-navegando-inflacion', 5, 5, 'http://localhost:8081/article/economia-global-2024-navegando-inflacion', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 07:38:06'),
(34, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:27:26'),
(35, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:31:41'),
(36, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:32:04'),
(37, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:32:10'),
(38, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:32:28'),
(39, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:32:34'),
(40, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:33:33'),
(41, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:33:53'),
(42, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:38:15'),
(43, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:38:24'),
(44, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:41:10'),
(45, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/regreso-del-cine-imax-ganando', 4, 3, 'http://localhost:8080/article/regreso-del-cine-imax-ganando', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:41:13'),
(46, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/regreso-del-cine-imax-ganando', 4, 3, 'http://localhost:8080/article/regreso-del-cine-imax-ganando', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:42:55'),
(47, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/regreso-del-cine-imax-ganando', 4, 3, 'http://localhost:8080/article/regreso-del-cine-imax-ganando', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:43:18'),
(48, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:46:38'),
(49, '2647c991036a8ab6b11eb3d4976b1b9dfcaa460e5c7a56b6bec9362888d31f77', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'Safari', '18.5', 'iOS', 'mobile', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:46:49'),
(50, '2647c991036a8ab6b11eb3d4976b1b9dfcaa460e5c7a56b6bec9362888d31f77', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'Safari', '18.5', 'iOS', 'mobile', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:52:03'),
(51, '2647c991036a8ab6b11eb3d4976b1b9dfcaa460e5c7a56b6bec9362888d31f77', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'Safari', '18.5', 'iOS', 'mobile', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:55:02'),
(52, '2647c991036a8ab6b11eb3d4976b1b9dfcaa460e5c7a56b6bec9362888d31f77', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'Safari', '18.5', 'iOS', 'mobile', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:56:10'),
(53, '2647c991036a8ab6b11eb3d4976b1b9dfcaa460e5c7a56b6bec9362888d31f77', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'Safari', '18.5', 'iOS', 'mobile', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:57:40'),
(54, '2647c991036a8ab6b11eb3d4976b1b9dfcaa460e5c7a56b6bec9362888d31f77', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'Safari', '18.5', 'iOS', 'mobile', 0, 'article_view', '/article/final-champions-league-previa-tactica', 2, 2, 'http://localhost:8080/article/final-champions-league-previa-tactica', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:57:46'),
(55, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 18:58:18'),
(56, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:00:40'),
(57, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/juego-indie-ano-ascenso-nebula', 3, 4, 'http://localhost:8080/article/juego-indie-ano-ascenso-nebula', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:01:12'),
(58, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/futuro-ia-mas-alla-grandes-modelos-lenguaje', 1, 1, 'http://localhost:8080/article/futuro-ia-mas-alla-grandes-modelos-lenguaje', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:02:24'),
(59, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/article/futuro-ia-mas-alla-grandes-modelos-lenguaje', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:07:47'),
(60, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:08:01'),
(61, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/futuro-ia-mas-alla-grandes-modelos-lenguaje', 1, 1, 'http://localhost:8080/articulo/futuro-ia-mas-alla-grandes-modelos-lenguaje', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:08:04'),
(62, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/articulo/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:08:11'),
(63, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/articulo/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:09:30'),
(64, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:10:07'),
(65, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:11:58'),
(66, '2647c991036a8ab6b11eb3d4976b1b9dfcaa460e5c7a56b6bec9362888d31f77', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'Safari', '18.5', 'iOS', 'mobile', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:11:58'),
(67, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:27:19'),
(68, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/1/edit', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-07 19:28:33'),
(69, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 00:46:52'),
(70, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/final-champions-league-previa-tactica', 2, 2, 'http://localhost:8080/articulo/final-champions-league-previa-tactica', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 00:47:07'),
(71, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 00:47:11'),
(72, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:00:52'),
(73, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:04:42'),
(74, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:12:00'),
(75, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:16:44'),
(76, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:16:55'),
(77, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:20:03'),
(78, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:21:50'),
(79, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:24:29'),
(80, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 01:28:47'),
(81, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/new', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 02:43:03'),
(82, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/admin/articles/11/edit', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 02:59:02'),
(83, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'home_view', '/', NULL, NULL, 'http://localhost:8080/', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 03:01:55'),
(84, '9b2d4700e13b5adffaa9cafd7eb858a315939d3fa3ffde5572e3ef75148cced1', 'b8bf8dbc6695c9934ab5c98058e4f15aa6325c61b62a54d271473a224ef6e3ae', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', 'Chrome', '145.0.0.0', 'macOS', 'desktop', 0, 'article_view', '/article/por-que-para-chivas-el-clasico-contra-atlas-puede-ser-mas-importante-que-contra-america', 11, 2, 'http://localhost:8080/articulo/por-que-para-chivas-el-clasico-contra-atlas-puede-ser-mas-importante-que-contra-america', 'localhost', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-09 03:02:02');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_login_codes`
--
ALTER TABLE `admin_login_codes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email_expires` (`email`,`expires_at`),
  ADD KEY `idx_expires` (`expires_at`);

--
-- Indexes for table `articles`
--
ALTER TABLE `articles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `subcategory_id` (`subcategory_id`),
  ADD KEY `idx_status_published` (`status`,`published_at`),
  ADD KEY `idx_category` (`category_id`),
  ADD KEY `idx_author` (`author_id`),
  ADD KEY `idx_featured` (`featured`),
  ADD KEY `idx_trending` (`trending`);
ALTER TABLE `articles` ADD FULLTEXT KEY `idx_search` (`title`,`excerpt`,`content`);

--
-- Indexes for table `article_blocks`
--
ALTER TABLE `article_blocks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_article_position` (`article_id`,`position`);

--
-- Indexes for table `article_tags`
--
ALTER TABLE `article_tags`
  ADD PRIMARY KEY (`article_id`,`tag_id`),
  ADD KEY `tag_id` (`tag_id`);

--
-- Indexes for table `authors`
--
ALTER TABLE `authors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_sort_order` (`sort_order`);

--
-- Indexes for table `comments`
--
ALTER TABLE `comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `parent_id` (`parent_id`),
  ADD KEY `idx_article_status` (`article_id`,`status`),
  ADD KEY `idx_comments_ip_created` (`ip_hash`,`created_at`),
  ADD KEY `idx_comments_status_created` (`status`,`created_at`),
  ADD KEY `idx_comments_email` (`author_email`);

--
-- Indexes for table `media`
--
ALTER TABLE `media`
  ADD PRIMARY KEY (`id`),
  ADD KEY `uploaded_by` (`uploaded_by`);

--
-- Indexes for table `newsletter_subscribers`
--
ALTER TABLE `newsletter_subscribers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_status` (`status`),
  ADD UNIQUE KEY `uq_newsletter_confirm_token` (`confirm_token`),
  ADD UNIQUE KEY `uq_newsletter_unsubscribe_token` (`unsubscribe_token`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_system_settings_key` (`setting_key`);

--
-- Indexes for table `subcategories`
--
ALTER TABLE `subcategories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_subcategory_slug` (`category_id`,`slug`);

--
-- Indexes for table `tags`
--
ALTER TABLE `tags`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_users_author` (`author_id`);

--
-- Indexes for table `visitors`
--
ALTER TABLE `visitors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_event_created` (`event_type`,`created_at`),
  ADD KEY `idx_session` (`session_id`),
  ADD KEY `idx_ip_hash` (`ip_hash`),
  ADD KEY `idx_article` (`article_id`),
  ADD KEY `idx_category` (`category_id`),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `idx_country_created` (`ip_country`,`created_at`),
  ADD KEY `idx_user` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin_login_codes`
--
ALTER TABLE `admin_login_codes`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `articles`
--
ALTER TABLE `articles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `article_blocks`
--
ALTER TABLE `article_blocks`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT for table `authors`
--
ALTER TABLE `authors`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `comments`
--
ALTER TABLE `comments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `media`
--
ALTER TABLE `media`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `newsletter_subscribers`
--
ALTER TABLE `newsletter_subscribers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `subcategories`
--
ALTER TABLE `subcategories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `tags`
--
ALTER TABLE `tags`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `visitors`
--
ALTER TABLE `visitors`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=85;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `articles`
--
ALTER TABLE `articles`
  ADD CONSTRAINT `articles_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  ADD CONSTRAINT `articles_ibfk_2` FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `articles_ibfk_3` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`);

--
-- Constraints for table `article_blocks`
--
ALTER TABLE `article_blocks`
  ADD CONSTRAINT `article_blocks_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `article_tags`
--
ALTER TABLE `article_tags`
  ADD CONSTRAINT `article_tags_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `article_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `comments`
--
ALTER TABLE `comments`
  ADD CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `comments_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `media`
--
ALTER TABLE `media`
  ADD CONSTRAINT `media_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `subcategories`
--
ALTER TABLE `subcategories`
  ADD CONSTRAINT `subcategories_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_author` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `visitors`
--
ALTER TABLE `visitors`
  ADD CONSTRAINT `visitors_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `visitors_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `visitors_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- Indexes added by 20261126_160000_* migrations
ALTER TABLE `subcategories` ADD KEY `idx_subcategories_sort` (`category_id`, `sort_order`);
ALTER TABLE `audit_log` ADD INDEX `idx_audit_user_created` (`user_id`, `created_at`);
ALTER TABLE `mcp_audit_logs` ADD INDEX `idx_mcp_audit_confirm_created` (`confirm`, `created_at`);

-- Migration: keep old section URLs working after a slug change
-- Date: 2026-11-26 17:00:00

CREATE TABLE `category_slug_redirects` (
  `old_slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`old_slug`),
  KEY `idx_category_redirects_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
