require('dotenv').config();
const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();

const bot = new Telegraf(process.env.BOT_TOKEN);

const db = new sqlite3.Database('./cerebro.db', (err) => {
    if (err) {
        console.error('Error al abrir la base de datos', err.message);
    } else {
        console.log('Base de datos conectada.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS tareas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                descripcion TEXT NOT NULL,
                categoria TEXT DEFAULT 'general'
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT NOT NULL,
                dia_emision TEXT NOT NULL,
                episodio_actual INTEGER DEFAULT 0
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS rutinas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dia_semana TEXT NOT NULL,
                enfoque TEXT NOT NULL,
                ejercicios TEXT NOT NULL
            )`);
        });
    }
});

// Inicialización de entrenamientos de hipertrofia
const inicializarRutinas = () => {
    db.get("SELECT count(*) as count FROM rutinas", (err, row) => {
        if (row && row.count === 0) {
            const rutinasBase = [
                ['lunes', 'Pecho y Tríceps', 'Press banca, Inclinado con mancuernas, Fondos, Extensiones de tríceps en polea'],
                ['martes', 'Espalda y Bíceps', 'Dominadas, Remo con barra, Jalón al pecho, Curl con barra, Curl martillo'],
                ['miercoles', 'Piernas (Cuádriceps/Glúteos)', 'Sentadillas, Prensa, Extensiones, Zancadas'],
                ['jueves', 'Hombros y Abdomen', 'Press militar, Elevaciones laterales, Face pull, Crunches, Planchas'],
                ['viernes', 'Piernas (Isquios/Pantorrillas)', 'Peso muerto rumano, Curl femoral, Elevaciones de talón']
            ];
            const stmt = db.prepare("INSERT INTO rutinas (dia_semana, enfoque, ejercicios) VALUES (?, ?, ?)");
            rutinasBase.forEach(r => stmt.run(r));
            stmt.finalize();
        }
    });
};
inicializarRutinas();

// Diccionario del horario universitario
const horarioUTP = {
    1: "*Lunes:*\n- 12:50 a 3:15 PM: Mantenimiento y Pruebas (Aula 3-418)\n- 3:20 a 5:45 PM: Redes de Computadoras (Aula 3-420 / 3-402 L)",
    2: "*Martes:*\n- 12:50 a 3:15 PM: Sistemas Operativos (Aula 3-418)\n- 3:20 a 5:45 PM: Ingeniería Web (Aula 3-421 / 3-N03 L)",
    3: "*Miércoles:*\n- 12:50 a 2:25 PM: Mantenimiento y Pruebas L (Aula 3-N03)\n- 2:30 a 5:45 PM: Lenguajes Formales (Aula 3-310 / 3-404 L)",
    4: "*Jueves:*\n- 12:50 a 2:25 PM: Redes de Computadoras (Aula 3-308)\n- 2:30 a 4:05 PM: Sistemas Operativos L (Aula 3-401)\n- 4:10 a 5:45 PM: Ingeniería Ambiental L (Aula 3-320)",
    5: "*Viernes:*\n- 12:50 a 2:25 PM: Lenguajes Formales (Aula 3-317)\n- 2:30 a 4:05 PM: Ingeniería Web (Aula 3-317)\n- 4:10 a 5:45 PM: Ingeniería Ambiental (Aula 3-317)"
};

bot.start((ctx) => {
    ctx.reply(
        `🧠 *Cerebro-bot v2.0* - Ecosistema Integrado\n\n` +
        `📚 *Estudios y Proyectos:*\n` +
        `/tarea [texto] - Tarea general\n` +
        `/asignacion [Categoría] - [Tarea] - Tarea ligada a materia o proyecto (ej. /asignacion Kpop Gala - Configurar base de datos)\n` +
        `/tareas - Lista de pendientes\n` +
        `/completada [ID] - Borrar tarea\n` +
        `/clases [hoy|mañana|lunes...] - Ver horario universitario\n\n` +
        `📺 *Series y Animación:*\n` +
        `/serie [Título] - [Día] - Agregar programa (ej. /serie Scarlet Heart - lunes)\n` +
        `/emision hoy - Estrenos del día\n` +
        `/visto [ID] - Marcar episodio como visto (+1)\n\n` +
        `🏋️ *Gimnasio:*\n` +
        `/rutina hoy - Ver entrenamiento asignado`, { parse_mode: 'Markdown' }
    );
});

// Comandos de Tareas y Proyectos
bot.command('tarea', (ctx) => {
    const texto = ctx.message.text.replace('/tarea', '').trim();
    if (!texto) return ctx.reply('⚠️ Ejemplo: /tarea Revisar envíos internacionales');
    
    db.run(`INSERT INTO tareas (descripcion, categoria) VALUES (?, ?)`, [texto, 'general'], (err) => {
        if (err) return ctx.reply('❌ Error al guardar.');
        ctx.reply(`✅ Tarea guardada: "${texto}"`);
    });
});

bot.command('asignacion', (ctx) => {
    const texto = ctx.message.text.replace('/asignacion', '').trim();
    if (!texto.includes('-')) return ctx.reply('⚠️ Formato: /asignacion [Materia/Proyecto] - [Descripción]\nEjemplo: /asignacion ABISMO - Ajustar Three.js');
    
    const [categoria, descripcion] = texto.split('-').map(s => s.trim());
    db.run(`INSERT INTO tareas (descripcion, categoria) VALUES (?, ?)`, [descripcion, categoria], (err) => {
        if (err) return ctx.reply('❌ Error al guardar la asignación.');
        ctx.reply(`✅ Asignación de *${categoria}* guardada: "${descripcion}"`, { parse_mode: 'Markdown' });
    });
});

bot.command('tareas', (ctx) => {
    db.all(`SELECT id, descripcion, categoria FROM tareas`, [], (err, filas) => {
        if (err) return ctx.reply('❌ Error de lectura.');
        if (filas.length === 0) return ctx.reply('🎉 No tienes tareas pendientes.');
        
        let mensaje = '📋 *Gestor de Proyectos y Tareas:*\n\n';
        filas.forEach(f => {
            mensaje += `[${f.id}] *[${f.categoria.toUpperCase()}]* ${f.descripcion}\n`;
        });
        ctx.replyWithMarkdown(mensaje);
    });
});

bot.command('completada', (ctx) => {
    const id = parseInt(ctx.message.text.replace('/completada', '').trim(), 10);
    if (isNaN(id)) return ctx.reply('⚠️ Ejemplo: /completada 3');

    db.run(`DELETE FROM tareas WHERE id = ?`, [id], function(err) {
        if (err) return ctx.reply('❌ Error al borrar.');
        if (this.changes === 0) return ctx.reply(`⚠️ Tarea no encontrada en el sistema.`);
        ctx.reply(`✅ Tarea [${id}] extraída de la memoria.`);
    });
});

// Comandos de Horario
bot.command('clases', (ctx) => {
    const query = ctx.message.text.replace('/clases', '').trim().toLowerCase();
    let diaNum = new Date().getDay(); 
    
    const diasMapa = { 'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3, 'jueves': 4, 'viernes': 5 };
    if (query === 'mañana') diaNum = (diaNum + 1) % 7;
    else if (diasMapa[query]) diaNum = diasMapa[query];

    if (diaNum === 0 || diaNum === 6) return ctx.reply('🎉 Día libre sin clases asignadas.');
    if (horarioUTP[diaNum]) return ctx.replyWithMarkdown(horarioUTP[diaNum]);
});

// Comandos de Emisión
bot.command('serie', (ctx) => {
    const texto = ctx.message.text.replace('/serie', '').trim();
    if (!texto.includes('-')) return ctx.reply('⚠️ Formato: /serie [Título] - [día de la semana]');
    
    const [titulo, dia] = texto.split('-').map(s => s.trim().toLowerCase());
    db.run(`INSERT INTO series (titulo, dia_emision) VALUES (?, ?)`, [titulo, dia], (err) => {
        if (err) return ctx.reply('❌ Error al guardar.');
        ctx.reply(`✅ *${titulo}* vinculada a los días ${dia}.`, { parse_mode: 'Markdown' });
    });
});

bot.command('emision', (ctx) => {
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    let hoy = dias[new Date().getDay()];
    
    const parametro = ctx.message.text.replace('/emision', '').trim().toLowerCase();
    if (parametro && dias.includes(parametro)) hoy = parametro;

    db.all(`SELECT id, titulo, episodio_actual FROM series WHERE dia_emision = ?`, [hoy], (err, filas) => {
        if (err) return ctx.reply('❌ Error al consultar la base de datos.');
        if (filas.length === 0) return ctx.reply(`No hay contenido programado para el día ${hoy}.`);
        
        let msj = `📺 *Emisiones para el ${hoy}:*\n\n`;
        filas.forEach(f => msj += `[${f.id}] ${f.titulo} (Progreso: Ep. ${f.episodio_actual})\n`);
        ctx.replyWithMarkdown(msj);
    });
});

bot.command('visto', (ctx) => {
    const id = parseInt(ctx.message.text.replace('/visto', '').trim(), 10);
    if (isNaN(id)) return ctx.reply('⚠️ Ejemplo: /visto 1');

    db.run(`UPDATE series SET episodio_actual = episodio_actual + 1 WHERE id = ?`, [id], function(err) {
        if (err || this.changes === 0) return ctx.reply('❌ Error actualizando o ID inválido.');
        db.get(`SELECT titulo, episodio_actual FROM series WHERE id = ?`, [id], (err, row) => {
            ctx.reply(`✅ Tracker actualizado: *${row.titulo}* -> Episodio ${row.episodio_actual}`, { parse_mode: 'Markdown' });
        });
    });
});

// Comando para ver todo el plan de entrenamiento de la semana
bot.command('rutinas', (ctx) => {
    db.all(`SELECT dia_semana, enfoque, ejercicios FROM rutinas`, [], (err, filas) => {
        if (err) return ctx.reply('❌ Error al consultar las rutinas.');
        if (filas.length === 0) return ctx.reply('⚠️ No hay rutinas guardadas en la base de datos.');
        
        let mensaje = '🏋️‍♂️ *Plan Semanal de Hipertrofia:*\n\n';
        filas.forEach(f => {
            // Pone la primera letra del día en mayúscula
            const dia = f.dia_semana.charAt(0).toUpperCase() + f.dia_semana.slice(1);
            mensaje += `*${dia}:* ${f.enfoque}\n└ ${f.ejercicios.replace(/, /g, '\n└ ')}\n\n`;
        });
        
        ctx.replyWithMarkdown(mensaje);
    });
});

// Comandos de Entrenamiento
bot.command('rutina', (ctx) => {
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    let diaSeleccionado = dias[new Date().getDay()];
    
    const parametro = ctx.message.text.replace('/rutina', '').trim().toLowerCase();
    if (parametro === 'mañana') diaSeleccionado = dias[(new Date().getDay() + 1) % 7];
    else if (dias.includes(parametro)) diaSeleccionado = parametro;

    db.get(`SELECT enfoque, ejercicios FROM rutinas WHERE dia_semana = ?`, [diaSeleccionado], (err, row) => {
        if (err) return ctx.reply('❌ Error de consulta.');
        if (!row) return ctx.reply('🛋️ Recuperación muscular. No hay rutina asignada.');
        
        ctx.replyWithMarkdown(`🏋️‍♂️ *Bloque del ${diaSeleccionado}: ${row.enfoque}*\n\nCircuitos:\n- ${row.ejercicios.replace(/, /g, '\n- ')}`);
    });
});

// Comando para "limpiar" la pantalla en Telegram
bot.command('limpiar', (ctx) => {
    const saltosDeLinea = '\n'.repeat(60);
    ctx.reply(`🧹 Limpiando el chat...${saltosDeLinea}✨ ¡Pantalla despejada!`);
});
bot.catch((err, ctx) => console.error(`[Fallo en Telegraf]`, err.message));

bot.launch();
console.log('Cerebro-bot v2 en línea. Tablas relacionales y horario cargados exitosamente.');

process.once('SIGINT', () => { db.close(); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { db.close(); bot.stop('SIGTERM'); });