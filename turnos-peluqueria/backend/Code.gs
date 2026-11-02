/**
 * Backend de turnos para la peluquería — Google Apps Script.
 * Instrucciones completas en LEEME.md. Resumen:
 *  1. Crear una Planilla de Google nueva → Extensiones → Apps Script.
 *  2. Pegar este archivo entero en Code.gs y guardar.
 *  3. Elegir la función "instalar" y tocar Ejecutar (acepta los permisos).
 *  4. Implementar → Nueva implementación → Aplicación web
 *     · Ejecutar como: Yo   · Quién tiene acceso: Cualquier usuario
 *  5. Copiar la URL (termina en /exec) y pegarla en API_URL de logica.js.
 */

var ZONA = 'America/Argentina/Buenos_Aires';
var COLS = ['id', 'fecha', 'hora', 'duracion', 'servicio', 'nombre', 'telefono', 'nota', 'estado', 'creado'];

/* ----- inicio del bloque copiado de logica.js (mantener igual) ----- */
function aMin(h) { var p = String(h).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function aHora(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function fechaDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dateDe(f) { var p = f.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function sumarDias(f, n) { var d = dateDe(f); d.setDate(d.getDate() + n); return fechaDe(d); }

/* Franjas abiertas de un día: primero mira si hay una excepción para esa fecha
   (cerrado o horario especial); si no, usa la semana tipo. */
function franjasDelDia(cfg, fecha) {
  if (cfg.excepciones && Object.prototype.hasOwnProperty.call(cfg.excepciones, fecha)) return cfg.excepciones[fecha] || [];
  return (cfg.semana && cfg.semana[String(dateDe(fecha).getDay())]) || [];
}

function turnosActivos(turnos) { return turnos.filter(function (t) { return t.estado !== 'cancelado'; }); }

/* ahora = { fecha: 'YYYY-MM-DD', min: minutos desde las 00:00 } */
function horariosLibres(cfg, turnos, fecha, duracion, ahora) {
  if (fecha < ahora.fecha || fecha > sumarDias(ahora.fecha, Number(cfg.diasVista) || 30)) return [];
  var paso = Number(cfg.paso) || 30;
  var desde = fecha === ahora.fecha ? ahora.min + (Number(cfg.anticipacionMin) || 0) : -1;
  var ocupado = turnosActivos(turnos).filter(function (t) { return t.fecha === fecha; })
    .map(function (t) { var a = aMin(t.hora); return [a, a + Number(t.duracion)]; });
  var libres = [];
  franjasDelDia(cfg, fecha).forEach(function (f) {
    var fin = aMin(f[1]);
    for (var t = aMin(f[0]); t + duracion <= fin; t += paso) {
      if (t < desde) continue;
      var choca = ocupado.some(function (o) { return t < o[1] && t + duracion > o[0]; });
      if (!choca) libres.push(aHora(t));
    }
  });
  return libres;
}

function soloDigitos(s) { return String(s || '').replace(/\D/g, ''); }

/* Devuelve un texto de error o null si la reserva es válida. */
function validarReserva(cfg, turnos, d, ahora) {
  var serv = (cfg.servicios || []).filter(function (s) { return s.id === d.servicio; })[0];
  if (!serv) return 'Elegí un servicio.';
  if (!d.nombre || String(d.nombre).trim().length < 2) return 'Escribí tu nombre.';
  if (soloDigitos(d.telefono).length < 8) return 'Revisá el número de WhatsApp.';
  if (horariosLibres(cfg, turnos, d.fecha, Number(serv.duracion), ahora).indexOf(d.hora) === -1)
    return 'Ese horario se acaba de ocupar. Elegí otro.';
  var tel = soloDigitos(d.telefono).slice(-8);
  var futuros = turnosActivos(turnos).filter(function (t) {
    return t.fecha >= ahora.fecha && soloDigitos(t.telefono).slice(-8) === tel;
  });
  if (futuros.length >= 2) return 'Ya tenés 2 turnos reservados. Para otro, escribinos por WhatsApp.';
  return null;
}

function haySuperposicion(turnos, fecha, hora, duracion) {
  var a = aMin(hora), b = a + Number(duracion);
  return turnosActivos(turnos).some(function (t) {
    if (t.fecha !== fecha) return false;
    var x = aMin(t.hora); return a < x + Number(t.duracion) && b > x;
  });
}
/* ----- fin del bloque copiado ----- */

var CONFIG_INICIAL = {
  nombre: 'Tu Peluquería', direccion: 'Olavarría', whatsapp: '', emailAviso: '',
  paso: 30, diasVista: 30, anticipacionMin: 120,
  servicios: [
    { id: 'corte', nombre: 'Corte', duracion: 30, precio: '' },
    { id: 'corte-brushing', nombre: 'Corte y brushing', duracion: 60, precio: '' },
    { id: 'color', nombre: 'Color', duracion: 120, precio: '' },
    { id: 'mechas', nombre: 'Mechas / balayage', duracion: 180, precio: '' },
    { id: 'peinado', nombre: 'Peinado para evento', duracion: 60, precio: '' }
  ],
  semana: {
    '0': [], '1': [],
    '2': [['09:00', '13:00'], ['16:00', '20:00']], '3': [['09:00', '13:00'], ['16:00', '20:00']],
    '4': [['09:00', '13:00'], ['16:00', '20:00']], '5': [['09:00', '13:00'], ['16:00', '20:00']],
    '6': [['09:00', '14:00']]
  },
  excepciones: {}
};


function instalar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName('Turnos') || ss.insertSheet('Turnos');
  h.getRange(1, 1, h.getMaxRows(), COLS.length).setNumberFormat('@');
  h.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
  h.setFrozenRows(1);
  var c = ss.getSheetByName('Config') || ss.insertSheet('Config');
  c.getRange('A1').setNumberFormat('@');
  if (!c.getRange('A1').getValue()) c.getRange('A1').setValue(JSON.stringify(CONFIG_INICIAL));
  c.getRange('A3').setValue('No edites la celda A1 a mano: se cambia desde el panel de la página.');
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PIN')) props.setProperty('PIN', '1234');
  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && ss.getSheets().length > 2) ss.deleteSheet(hoja1);
  Logger.log('Listo. PIN inicial: ' + props.getProperty('PIN') + ' (cambialo desde el panel).');
}

function ahoraAR() {
  var d = new Date();
  return { fecha: Utilities.formatDate(d, ZONA, 'yyyy-MM-dd'), min: Number(Utilities.formatDate(d, ZONA, 'H')) * 60 + Number(Utilities.formatDate(d, ZONA, 'm')) };
}
function hojaTurnos() { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Turnos'); }
function leerConfig() {
  var v = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config').getRange('A1').getValue();
  return v ? JSON.parse(v) : JSON.parse(JSON.stringify(CONFIG_INICIAL));
}
function leerTurnos() {
  var h = hojaTurnos(), n = h.getLastRow() - 1;
  if (n < 1) return [];
  return h.getRange(2, 1, n, COLS.length).getDisplayValues().map(function (r, i) {
    var t = { fila: i + 2 };
    COLS.forEach(function (k, j) { t[k] = r[j]; });
    t.duracion = Number(t.duracion);
    return t;
  }).filter(function (t) { return t.id; });
}
function escribirTurno(t) {
  var h = hojaTurnos(), fila = h.getLastRow() + 1;
  h.getRange(fila, 1, 1, COLS.length).setNumberFormat('@')
    .setValues([COLS.map(function (k) { return t[k] == null ? '' : String(t[k]); })]);
}
function chequearPin(pin) {
  if (!pin || String(pin) !== PropertiesService.getScriptProperties().getProperty('PIN')) throw new Error('PIN incorrecto.');
}
function limpiar(t) { var o = {}; COLS.forEach(function (k) { o[k] = t[k]; }); return o; }
function texto(s, max) { return String(s == null ? '' : s).trim().slice(0, max || 200); }

function responder(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  try {
    if ((e.parameter || {}).accion !== 'publico') return responder({ error: 'Acción desconocida.' });
    var hoy = ahoraAR().fecha;
    var ocupados = turnosActivos(leerTurnos()).filter(function (t) { return t.fecha >= hoy; })
      .map(function (t) { return { fecha: t.fecha, hora: t.hora, duracion: t.duracion }; }); // sin nombres ni teléfonos
    return responder({ cfg: leerConfig(), ocupados: ocupados });
  } catch (err) { return responder({ error: err.message }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var p = JSON.parse(e.postData.contents);
    lock.waitLock(15000);
    var r = acciones[p.accion] ? acciones[p.accion](p) : { error: 'Acción desconocida.' };
    return responder(r);
  } catch (err) {
    return responder({ error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

var acciones = {
  reservar: function (p) {
    var cfg = leerConfig(), turnos = leerTurnos(), d = p.datos || {};
    d = { servicio: texto(d.servicio, 60), fecha: texto(d.fecha, 10), hora: texto(d.hora, 5), nombre: texto(d.nombre, 80), telefono: texto(d.telefono, 30), nota: texto(d.nota, 300) };
    var err = validarReserva(cfg, turnos, d, ahoraAR());
    if (err) return { error: err };
    var serv = cfg.servicios.filter(function (s) { return s.id === d.servicio; })[0];
    var t = { id: Utilities.getUuid().slice(0, 12), fecha: d.fecha, hora: d.hora, duracion: Number(serv.duracion), servicio: serv.nombre,
      nombre: d.nombre, telefono: d.telefono, nota: d.nota, estado: 'confirmado', creado: Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm') };
    escribirTurno(t);
    avisar(cfg, t);
    return { id: t.id };
  },
  admin: function (p) {
    chequearPin(p.pin);
    var desde = sumarDias(ahoraAR().fecha, -30);
    return { cfg: leerConfig(), turnos: leerTurnos().filter(function (t) { return t.fecha >= desde; }).map(limpiar) };
  },
  guardarConfig: function (p) {
    chequearPin(p.pin);
    var c = p.cfg;
    if (!c || !c.semana || !Array.isArray(c.servicios) || typeof c.excepciones !== 'object') return { error: 'Configuración inválida.' };
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config').getRange('A1').setValue(JSON.stringify(c));
    return { ok: true };
  },
  cancelar: function (p) {
    chequearPin(p.pin);
    var t = leerTurnos().filter(function (x) { return x.id === p.id; })[0];
    if (!t) return { error: 'No encontré ese turno.' };
    hojaTurnos().getRange(t.fila, COLS.indexOf('estado') + 1).setValue('cancelado');
    return { ok: true };
  },
  agregar: function (p) {
    chequearPin(p.pin);
    var d = p.datos || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || !/^\d{2}:\d{2}$/.test(d.hora) || !(Number(d.duracion) > 0)) return { error: 'Revisá día, hora y duración.' };
    if (haySuperposicion(leerTurnos(), d.fecha, d.hora, d.duracion)) return { error: 'Se superpone con otro turno de ese día.' };
    var t = { id: Utilities.getUuid().slice(0, 12), fecha: d.fecha, hora: d.hora, duracion: Number(d.duracion), servicio: texto(d.servicio, 60),
      nombre: texto(d.nombre, 80), telefono: texto(d.telefono, 30), nota: texto(d.nota, 300), estado: d.nombre ? 'confirmado' : 'bloqueo',
      creado: Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm') };
    escribirTurno(t);
    return { id: t.id };
  },
  cambiarPin: function (p) {
    chequearPin(p.pin);
    if (!/^\d{4,}$/.test(String(p.nuevo))) return { error: 'El PIN tiene que tener al menos 4 números.' };
    PropertiesService.getScriptProperties().setProperty('PIN', String(p.nuevo));
    return { ok: true };
  }
};

function avisar(cfg, t) {
  try {
    var para = cfg.emailAviso || Session.getEffectiveUser().getEmail();
    if (!para) return;
    MailApp.sendEmail(para, 'Turno nuevo: ' + t.nombre + ' · ' + fechaLarga(t.fecha) + ' ' + t.hora,
      t.nombre + ' reservó ' + t.servicio + '\n' + fechaLarga(t.fecha) + ' a las ' + t.hora + ' h (' + t.duracion + ' min)\n' +
      'WhatsApp: ' + t.telefono + (t.nota ? '\nNota: ' + t.nota : '') + '\n\nResponderle: https://wa.me/' + waNumero(t.telefono));
  } catch (err) { console.error(err); }
}

var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaLarga(f) { var d = dateDe(f); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
function waNumero(n) { n = soloDigitos(n).replace(/^0+/, ''); if (n.length === 10) n = '549' + n; return n; }
