/**
 * Personal Assistant — Google Apps Script
 * Backend Gmail + Calendar per Fabrizio Lonatica
 *
 * SETUP:
 * 1. Apri script.google.com → Nuovo progetto → incolla questo codice
 * 2. Nome progetto: "Personal Assistant API"
 * 3. Distribuisci → Nuova distribuzione → Tipo: App web
 *    - Esegui come: Me (f.lonatica@gmail.com)
 *    - Chi può accedere: Tutti (anche anonimi)
 * 4. Copia l'URL e incollalo in index.html → APPS_SCRIPT_URL
 */

var CALENDAR_ID    = 'f.lonatica@gmail.com';
var CALENDAR_CM_ID = '8818e1f2c7d4c445d0d7c506ee5e00dee042067189e8294df0568fef600a84f7@group.calendar.google.com';
var TIMEZONE       = 'Europe/Rome';

var ID_TO_COLOR = {
  '11': CalendarApp.EventColor.RED,
  '9':  CalendarApp.EventColor.BLUE,
  '5':  CalendarApp.EventColor.YELLOW,
  '8':  CalendarApp.EventColor.GRAY
};

var Q_TO_COLOR = {
  'Q1': CalendarApp.EventColor.RED,
  'Q2': CalendarApp.EventColor.BLUE,
  'Q3': CalendarApp.EventColor.YELLOW,
  'Q4': CalendarApp.EventColor.GRAY
};

// ----------------------------------------------------------------
// ENTRY POINT
// ----------------------------------------------------------------

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || '';
  var result;

  try {
    switch (action) {
      case 'getEmails':    result = getEmails();           break;
      case 'getEvents':    result = getEvents(params.days); break;
      case 'createEvent':  result = createCalEvent(params); break;
      case 'createDraft':  result = createGmailDraft(params); break;
      case 'ping':         result = { ok: true, ts: new Date().toISOString() }; break;
      default:             result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------
// GET EMAILS — starred + unread inbox
// ----------------------------------------------------------------

function getEmails() {
  var threads = GmailApp.search(
    'is:starred OR (is:unread in:inbox) -in:trash -in:spam',
    0, 20
  );

  var emails = threads.map(function(thread) {
    var msgs = thread.getMessages();
    var last = msgs[msgs.length - 1];
    return {
      id:           thread.getId(),
      subject:      thread.getFirstMessageSubject(),
      from:         last.getFrom(),
      date:         Utilities.formatDate(last.getDate(), TIMEZONE, 'dd/MM HH:mm'),
      snippet:      last.getPlainBody().replace(/\s+/g, ' ').substring(0, 200),
      isStarred:    thread.hasStarredMessages(),
      isUnread:     thread.isUnread(),
      messageCount: thread.getMessageCount()
    };
  });

  emails.sort(function(a, b) {
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;
    return 0;
  });

  return { emails: emails, count: emails.length };
}

// ----------------------------------------------------------------
// GET EVENTS — prossimi N giorni
// ----------------------------------------------------------------

function getEvents(daysParam) {
  var days = parseInt(daysParam) || 5;

  var start = new Date();
  start.setHours(0, 0, 0, 0);
  var end = new Date(start);
  end.setDate(end.getDate() + days);

  var events = [];

  // Calendario personale — filtra routine all-day senza Q
  var calPersonale = CalendarApp.getCalendarById(CALENDAR_ID);
  calPersonale.getEvents(start, end).forEach(function(ev) {
    var title = ev.getTitle();
    if (ev.isAllDayEvent() && !title.match(/Q[1-4]/i)) return;
    events.push(buildEventObj(ev, 'personale'));
  });

  // Calendario Casa Manager — include tutto (check-in, check-out, strutture)
  try {
    var calCM = CalendarApp.getCalendarById(CALENDAR_CM_ID);
    if (calCM) {
      calCM.getEvents(start, end).forEach(function(ev) {
        events.push(buildEventObj(ev, 'casa_manager'));
      });
    }
  } catch(e) {
    // Calendario CM non accessibile — ignora silenziosamente
  }

  // Ordina per data/ora
  events.sort(function(a, b) { return a.startISO.localeCompare(b.startISO); });

  return { events: events, count: events.length };
}

function buildEventObj(ev, source) {
  var startTime = ev.getStartTime();
  return {
    id:       ev.getId(),
    title:    ev.getTitle(),
    date:     Utilities.formatDate(startTime, TIMEZONE, 'dd/MM'),
    time:     ev.isAllDayEvent() ? '' : Utilities.formatDate(startTime, TIMEZONE, 'HH:mm'),
    startISO: Utilities.formatDate(startTime, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"),
    endISO:   Utilities.formatDate(ev.getEndTime(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"),
    isAllDay: ev.isAllDayEvent(),
    quadrant: detectQuadrant(ev),
    source:   source,
    desc:     ev.getDescription() || ''
  };
}

function detectQuadrant(ev) {
  var m = ev.getTitle().match(/Q([1-4])/i);
  if (m) return 'Q' + m[1];

  var colorMap = {
    'TOMATO':    'Q1', 'FLAMINGO': 'Q1',
    'BLUEBERRY': 'Q2', 'PEACOCK':  'Q2',
    'BANANA':    'Q3', 'SAGE':     'Q3',
    'GRAPHITE':  'Q4', 'BASIL':    'Q4'
  };
  return colorMap[ev.getColor()] || null;
}

// ----------------------------------------------------------------
// CREATE CALENDAR EVENT
// ----------------------------------------------------------------

function createCalEvent(params) {
  if (!params.title || !params.start) return { error: 'Missing title or start' };

  var cal   = CalendarApp.getCalendarById(CALENDAR_ID);
  var start = new Date(params.start);
  var end   = params.end ? new Date(params.end) : new Date(start.getTime() + 3600000);

  var opts = {};
  if (params.desc) opts.description = params.desc;

  var ev = cal.createEvent(params.title, start, end, opts);

  var color = ID_TO_COLOR[params.colorId] || Q_TO_COLOR[params.quadrant];
  if (color) ev.setColor(color);

  return {
    success: true,
    message: 'Evento creato: ' + params.title,
    eventId: ev.getId(),
    date:    Utilities.formatDate(start, TIMEZONE, 'EEE dd/MM HH:mm')
  };
}

// ----------------------------------------------------------------
// CREATE GMAIL DRAFT
// ----------------------------------------------------------------

function createGmailDraft(params) {
  if (!params.to || !params.subject) return { error: 'Missing to or subject' };

  GmailApp.createDraft(
    params.to,
    params.subject,
    params.body || ''
  );

  return {
    success: true,
    message: 'Bozza creata: "' + params.subject + '" → ' + params.to
  };
}
