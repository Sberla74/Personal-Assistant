# Personal Assistant — CONTEXT

## Stack
- **Frontend:** HTML/CSS/Vanilla JS — single file `index.html`
- **Backend:** Google Apps Script (`apps_script.gs`) per Gmail + Calendar
- **Database:** Firebase RTDB — stesso progetto di Casa Manager (`casa-manager-24414`)
- **AI:** Claude API via Cloudflare proxy (`trainer-ai-proxy.f-lonatica.workers.dev`)
- **Hosting:** GitHub Pages → `Sberla74/Personal-Assistant`

## Architettura
```
Browser (GitHub Pages)
   ↕ fetch GET
Google Apps Script (Gmail + Calendar API)

   ↕ fetch POST
Cloudflare Proxy → Claude API

   ↕ Firebase SDK
Firebase RTDB → /personal_assistant/chat/
```

---

## Setup iniziale (da fare una sola volta)

### 1. Apps Script — backend Gmail + Calendar

1. Vai su [script.google.com](https://script.google.com)
2. **Nuovo progetto** → incolla tutto il contenuto di `apps_script.gs`
3. Nome progetto: **"Personal Assistant API"**
4. **Distribuisci → Nuova distribuzione**
   - Tipo: **App web**
   - Esegui come: **Me (f.lonatica@gmail.com)**
   - Chi può accedere: **Tutti (anche anonimi)**
5. Autorizza le permission richieste (Gmail + Calendar)
6. **Copia l'URL** — sarà tipo:
   `https://script.google.com/macros/s/AKfy.../exec`

### 2. index.html — compilare le 3 variabili

Apri `index.html` e cerca il blocco `⚙️ CONFIGURAZIONE`:

```js
const FB_CONFIG = {
  apiKey:            "INSERISCI_API_KEY",        // ← da Firebase Console
  authDomain:        "casa-manager-24414.firebaseapp.com",
  databaseURL:       "https://casa-manager-24414-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "casa-manager-24414",
  storageBucket:     "casa-manager-24414.appspot.com",
  messagingSenderId: "INSERISCI_SENDER_ID",      // ← da Firebase Console
  appId:             "INSERISCI_APP_ID"          // ← da Firebase Console
};
const APPS_SCRIPT_URL = "INSERISCI_URL_APPS_SCRIPT"; // ← URL dal passo 1
```

**Dove trovare i valori Firebase:**
- Firebase Console → Progetto `casa-manager-24414`
- Impostazioni progetto → App web
- Copia `apiKey`, `messagingSenderId`, `appId`

### 3. Firebase — regole RTDB

Aggiungi al nodo delle regole esistenti di Casa Manager:

```json
"personal_assistant": {
  ".read":  "auth != null",
  ".write": "auth != null"
}
```

### 4. Cloudflare Proxy — CORS

Il proxy `trainer-ai-proxy.f-lonatica.workers.dev` deve permettere
richieste da `sberla74.github.io`. Se già permette `*.github.io` non
serve nulla. Altrimenti aggiorna le origini nel Worker.

### 5. GitHub Pages

1. `gh repo create Sberla74/Personal-Assistant --public`
2. `git init && git add . && git commit -m "init"`
3. `git push -u origin main`
4. Repository Settings → Pages → Branch: `main` → Root
5. URL produzione: `https://sberla74.github.io/Personal-Assistant/`

---

## Come funziona l'assistente

### Chat con Claude
- Sistema Covey (Q1/Q2/Q3/Q4) iniettato nel system prompt
- Calendario e Gmail del giorno caricati all'avvio come contesto
- Storico ultimi 40 messaggi salvato su Firebase

### Azioni automatiche
Claude può proporre azioni che l'utente deve approvare:

| Claude scrive | Effetto |
|---|---|
| `[EVENTO: Titolo \| 2026-06-18T10:00 \| 2026-06-18T11:00 \| 9]` | Card "Aggiungi al calendario" |
| `[BOZZA: email@dest.it \| Oggetto \| Testo]` | Card "Crea bozza Gmail" |

### Note iPhone → Review settimanale
1. Aprire note su iPhone
2. Copiare e incollare nell'area "Note iPhone" in sidebar
3. Premere "Review settimanale"
4. Claude classifica Q1-Q4 × 6 aree vita e propone gli eventi calendario

### Quadranti e colori calendario
| Q | Significato | Colore | colorId |
|---|---|---|---|
| Q1 | Urgente + Importante | 🔴 Rosso | 11 |
| Q2 | Non urgente + Importante | 🔵 Blu | 9 |
| Q3 | Urgente + Non importante | 🟡 Giallo | 5 |
| Q4 | Non urgente + Non importante | ⬛ Grigio | 8 |

---

## File
- `index.html` — app web completa (frontend + JS)
- `apps_script.gs` — backend Google Apps Script (Gmail + Calendar)
- `CONTEXT.md` — questo file

---

## Backlog

- [ ] Briefing mattutino automatico (routine schedulata → email digest a f.lonatica@gmail.com)
- [ ] Lettura corpo email completo per rispondere in chat
- [ ] Aggiunta eventi al calendario Casa Manager (strutture) separato da quello personale
- [ ] Modalità mobile (sidebar collapsible)
