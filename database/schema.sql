-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Mar 06, 2026 at 11:06 PM
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
-- Database: `alanchat_intelinota`
--

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
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `published_at` timestamp NULL DEFAULT NULL,
  `view_count` int(10) UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `articles`
--

INSERT INTO `articles` (`id`, `slug`, `title`, `excerpt`, `content`, `category_id`, `subcategory_id`, `author_id`, `image_url`, `read_time_minutes`, `featured`, `trending`, `status`, `published_at`, `view_count`, `created_at`, `updated_at`) VALUES
(1, 'futuro-ia-mas-alla-grandes-modelos-lenguaje', 'El Futuro de la IA: Más allá de los Grandes Modelos de Lenguaje', 'A medida que los LLM alcanzan su meseta, los investigadores exploran la IA neuro-simbólica como la próxima frontera para el razonamiento auténtico.', NULL, 1, 1, 1, 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000', 8, 1, 1, 'published', '2024-05-24 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(2, 'final-champions-league-previa-tactica', 'Final de la Champions League: Previa Táctica', 'Un análisis profundo de las estrategias de los dos gigantes que se enfrentarán en Wembley. ¿Quién dominará el mediocampo?', NULL, 2, 4, 2, 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1000', 6, 0, 1, 'published', '2024-05-23 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(3, 'juego-indie-ano-ascenso-nebula', 'Juego Indie del Año: El Ascenso de \'Nebula\'', 'Cómo un equipo de tres desarrolladores creó una obra maestra que desafía a los gigantes AAA en narrativa y mecánicas.', NULL, 4, 10, 3, 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1000', 10, 0, 0, 'published', '2024-05-22 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(4, 'regreso-del-cine-imax-ganando', 'El Regreso del Cine: Por qué IMAX está Ganando', 'Los cines están evolucionando. Exploramos cómo los formatos premium están devolviendo al público a la gran pantalla.', NULL, 3, 7, 4, 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1000', 5, 0, 0, 'published', '2024-05-21 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(5, 'economia-global-2024-navegando-inflacion', 'Economía Global 2024: Navegando la Inflación', 'Los bancos centrales caminan por la cuerda floja. Lo que significan los últimos datos para tus inversiones y vida diaria.', NULL, 5, 13, 5, 'https://images.unsplash.com/photo-1611974714014-4986423b9f36?auto=format&fit=crop&q=80&w=1000', 12, 0, 1, 'published', '2024-05-20 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(6, 'explorando-abismo-descubrimientos-fosa-marianas', 'Explorando el Abismo: Nuevos Descubrimientos en la Fosa de las Marianas', 'Científicos descubren cinco nuevas especies de criaturas bioluminiscentes en las partes más oscuras del océano.', NULL, 5, 14, 6, 'https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&q=80&w=1000', 15, 0, 0, 'published', '2024-05-19 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(7, 'dominando-metaverso-guia-principiantes', 'Dominando el Metaverso: Guía para Principiantes', 'Todo lo que necesitas saber sobre la próxima iteración de internet y cómo empezar hoy mismo.', NULL, 1, 2, 7, 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=1000', 7, 0, 0, 'published', '2024-05-18 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(8, 'evolucion-esports-sotanos-estadios', 'La Evolución de los Esports: De Sótanos a Estadios', 'Cómo el gaming competitivo se transformó en una industria multimillonaria con reconocimiento global.', NULL, 4, 11, 8, 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&q=80&w=1000', 9, 0, 0, 'published', '2024-05-17 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(9, 'arte-narrar-historias-series-tv-modernas', 'El Arte de Narrar Historias en las Series de TV Modernas', 'Por qué la actual \'Edad de Oro de la Televisión\' está redefiniendo el consumo de narrativas de formato largo.', NULL, 3, 8, 9, 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&q=80&w=1000', 11, 0, 0, 'published', '2024-05-16 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57'),
(10, 'revolucion-tenis-nueva-generacion-toma-mando', 'Revolución en el Tenis: La Nueva Generación Toma el Mando', 'Cómo las jóvenes estrellas están rompiendo la dominación del Big Three y cambiando la cara del deporte.', NULL, 2, 5, 10, 'https://images.unsplash.com/photo-1595435066373-67856e4c274b?auto=format&fit=crop&q=80&w=1000', 8, 0, 0, 'published', '2024-05-15 15:00:00', 0, '2026-03-07 04:23:57', '2026-03-07 04:23:57');

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
(51, 10, 5, 'quote', '{\"text\": \"Nunca había visto tanta calidad junta en una misma generación. Y lo mejor es que aún les queda mucho por mejorar.\", \"attribution\": \"John McEnroe, Comentarista\"}', '2026-03-07 04:23:57');

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
(10, 'Pete Sampras', 'pete-sampras', 'Analista de tenis y seguidor de la nueva generación.', NULL, NULL, NULL, '2026-03-07 04:23:56', '2026-03-07 04:23:56');

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
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','approved','spam') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
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
  `status` enum('active','unsubscribed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `subscribed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unsubscribed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `subcategories`
--

CREATE TABLE `subcategories` (
  `id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','editor','reader') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reader',
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verification_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_token_expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

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
  ADD KEY `idx_article_status` (`article_id`,`status`);

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
  ADD KEY `idx_status` (`status`);

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
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `articles`
--
ALTER TABLE `articles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `article_blocks`
--
ALTER TABLE `article_blocks`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=52;

--
-- AUTO_INCREMENT for table `authors`
--
ALTER TABLE `authors`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

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
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

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
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
