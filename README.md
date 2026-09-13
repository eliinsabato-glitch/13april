# 13 APRIL — Becoming Her

Una Progressive Web App personale: dashboard giornaliera adattiva, Minimum/Good/Great Day,
Exam Mode, Recovery Mode, tracking Pilates Reformer (10 sessioni), self-care ricorrente,
streak con "flex days", scoring intelligente, Weekly Reset, Monthly Review, importazione
calendario via .ics, **tracking Esami e Tirocinio (APRO)**, e **statistiche potenziate**
(heatmap, andamento mensile, media ponderata). Tutti i dati restano SOLO sul tuo telefono
(localStorage), niente server.

---

## A. Struttura del progetto

```
thirteen-april/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   └── style.css
├── js/
│   ├── db.js            (storage locale)
│   ├── calendar.js       (parsing .ics + analisi giornate)
│   ├── scoring.js         (scoring + streak)
│   ├── habits.js           (Pilates, self-care, adattività)
│   ├── tirocinio.js         (calendario APRO Linea Gialla + stato tirocinio)
│   ├── app.js                (stato e logica principale)
│   └── app-screens.js        (rendering delle schermate, incl. Esami)
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── apple-touch-icon.png
```

Nessun altro strumento è necessario: è HTML/CSS/JS puro, nessuna build, nessun Node,
nessun account developer.

---

## B. Come provarla subito (facoltativo, prima di pubblicarla)

Se vuoi solo dare un'occhiata dal computer prima di metterla online, apri semplicemente
`index.html` con un doppio click nel browser. Per usarla sull'iPhone, però, devi pubblicarla
online (Safari richiede https per il salvataggio dati e il service worker) — vai al punto D.

---

## C. Come funziona (riepilogo funzionale)

- **Countdown**: calcolato automaticamente verso il 13 aprile (o la data che scegli in onboarding/Settings).
- **Calendario**: importi un file `.ics` (esportabile da Calendario iOS, Google Calendar, Outlook...).
  L'app legge gli eventi REALI, calcola quante ore sono occupate ogni giorno e classifica
  ogni giornata come Light / Moderate / Busy / Very Busy.
- **Piano giornaliero**: in base al carico del giorno (e a Exam Mode / Recovery Mode se attivi),
  propone 3-5 priorità, mai una lista infinita.
- **Minimum Day**: una checklist essenziale. Completarla = giornata riuscita, sempre, anche se
  il resto non è stato fatto.
- **Exam Mode**: si attiva da solo quando il calendario dei prossimi 7 giorni mostra molte
  giornate pesanti/lunghe senza pause — riduce tutto tranne studio e sonno.
- **Recovery Mode**: si attiva se negli ultimi 3 giorni il Minimum Day è stato mancato almeno 2 volte
  — propone solo l'essenziale, senza colpevolizzare.
- **Pilates**: le 10 sessioni vengono distribuite automaticamente su ~3,5 mesi cercando i giorni
  migliori nel tuo calendario importato. Saltare una sessione mostra "Reschedule", mai "Failed".
- **Streak**: sopravvive a qualche giornata mancata grazie a "flex days" che si accumulano quando
  sei costante — non punitiva.
- **Scoring**: non è "task completati / task totali". Un giorno pieno di lezioni pesa meno per
  ottenere un punteggio alto; un giorno libero ne richiede un po' di più.
- **Esami** (nuova scheda "Esami"): aggiungi/modifica/elimina esami con data e CFU. Ogni esame
  in programma mostra il countdown e i "giorni di studio utili" rimasti (giorni non Very Busy
  tra oggi e la data). Segnando un esame "Superato" con un voto, l'app calcola la media
  ponderata per CFU in automatico.
- **Tirocinio / APRO** (dentro la scheda "Esami"): il calendario ufficiale delle rotazioni
  cliniche per la Linea Gialla (settembre 2026 – giugno 2027) è integrato di default. Finché
  non conosci il tuo gruppo PSD (1-4), le settimane che dipendono dal gruppo restano segnate
  "da confermare"; le settimane valide per tutta la linea (SimLab, OSR) sono già attive. Appena
  sai il tuo gruppo, selezionalo dalla scheda Esami — è sempre modificabile in seguito. Le
  settimane confermate vengono trattate come impegni fissi (assunti 8:00–14:00, lun-ven) nel
  calcolo del carico giornaliero: incidono su Today's load, Exam Mode e sulla programmazione
  del Pilates esattamente come un impegno da calendario .ics. Se le tue ore reali di tirocinio
  sono diverse, si possono correggere modificando gli orari in `js/tirocinio.js`
  (`syntheticEvents`).
- **Insights potenziato**: oltre a streak e pattern per giorno della settimana, ora include una
  heatmap delle ultime 12 settimane (stile GitHub), l'andamento della media punteggio mese per
  mese, e un riepilogo del prossimo esame con giorni di studio utili residui.
- **Weekly Reset / Monthly Review / April 13**: schermate riepilogative accessibili da "Journey".

---

## D. Pubblicarla GRATIS (nessuna competenza richiesta) — GitHub Pages

Questo è il metodo più semplice per chi non programma e non ha un Mac.

**STEP 1** — Vai su [github.com](https://github.com) e crea un account gratuito (email + password).

**STEP 2** — Una volta dentro, clicca sul "+" in alto a destra → **New repository**.
Dai un nome, ad esempio `13april` → spunta **Public** → **Create repository**.

**STEP 3** — Nella pagina del repository appena creato, clicca **Add file → Upload files**.

**STEP 4** — Trascina TUTTI i file e le cartelle di questo progetto dentro la finestra di upload
(index.html, manifest.json, service-worker.js, e le cartelle css/, js/, icons/ con tutto il loro
contenuto). GitHub mantiene automaticamente la struttura delle cartelle se le trascini insieme.
Poi clicca **Commit changes** in basso.

**STEP 5** — Vai su **Settings** (in alto nel repository) → nel menu a sinistra clicca **Pages**.

**STEP 6** — Sotto "Build and deployment", in **Branch** scegli `main` e cartella `/ (root)` →
clicca **Save**.

**STEP 7** — Aspetta 1-2 minuti, poi ricarica la pagina Settings → Pages: apparirà un link tipo
`https://tuonome.github.io/13april/`. Quello è il tuo indirizzo pubblico, gratuito, per sempre.

---

## E. Installarla sul tuo iPhone (SENZA Mac)

**STEP 1** — Apri **Safari** sull'iPhone (deve essere Safari, non Chrome: "Aggiungi a Home"
per le PWA funziona in modo affidabile solo da Safari).

**STEP 2** — Vai all'indirizzo che hai ottenuto al punto D (es. `https://tuonome.github.io/13april/`).

**STEP 3** — Aspetta che la pagina carichi completamente (vedrai la splash screen "13 · APRIL").

**STEP 4** — Tocca l'icona **Condividi** (il quadrato con la freccia verso l'alto, in basso
nella barra di Safari).

**STEP 5** — Scorri le opzioni e tocca **Aggiungi alla schermata Home**.

**STEP 6** — Conferma il nome ("13 April") e tocca **Aggiungi**.

Da questo momento hai una vera icona sulla Home, si apre a schermo intero senza barra di Safari,
e funziona anche offline dopo il primo caricamento.

---

## F. Come aggiornarla in futuro

1. Modifica i file (o fatteli generare di nuovo) sul computer.
2. Torna nel repository GitHub → **Add file → Upload files** → carica di nuovo i file modificati
   (GitHub li sovrascrive automaticamente).
3. Apri `service-worker.js` e cambia il numero nella riga `CACHE_NAME = '13april-cache-v2'`
   in `'13april-cache-v3'` (poi v4, v5...) — questo dice all'iPhone "scarica la versione nuova"
   invece di continuare a usare quella salvata offline.
4. Sull'iPhone, apri l'app e chiudila/riaprila una volta (o forza la chiusura da App Switcher)
   per far scaricare la nuova versione.

I tuoi dati personali (checklist, streak, Pilates, check-in, esami, gruppo tirocinio) restano
intatti: sono salvati separatamente nel telefono, non nei file che aggiorni.

---

## G. Checklist finale

- [ ] Countdown verso il 13 aprile visibile in Home
- [ ] Import file .ics funzionante (Settings → Import .ics, o durante onboarding)
- [ ] Il carico del giorno (Light/Moderate/Busy/Very Busy) cambia in base agli eventi importati
      E alle settimane di tirocinio confermate
- [ ] Today's plan mostra 3-5 priorità, mai di più
- [ ] Checklist Minimum Day spuntabile, "Day completed" appare al completamento
- [ ] Exam Mode si attiva automaticamente con calendario pieno nei prossimi 7 giorni
- [ ] Recovery Mode appare dopo 2+ giorni mancati su 3
- [ ] Reformer mostra X/10, sessioni cliccabili con "Mark completed" / "Reschedule"
- [ ] Habits: modificabili, eliminabili, se ne possono aggiungere di nuove
- [ ] Esami: si possono aggiungere, modificare, segnare come superati con voto
- [ ] Tirocinio: la settimana corrente e le prossime sono visibili, il gruppo PSD è selezionabile
- [ ] Insights mostra streak, heatmap 12 settimane, andamento mensile, pattern per giorno
- [ ] Weekly Reset e Monthly Review apribili da Journey
- [ ] Settings: cambio data obiettivo, export dati, reset dati
- [ ] App installata sulla Home Screen si apre fullscreen (no barra Safari)
- [ ] Funziona anche disattivando i dati / in modalità aereo dopo il primo caricamento

---

## Limiti onesti (nessuna finzione)

- **Nessuna lettura automatica del calendario iOS**: iOS non lo permette a una PWA. Devi
  ri-esportare e ri-importare il file .ics quando il tuo calendario cambia molto.
- **Notifiche**: funzionano solo dopo l'installazione in Home Screen, e solo se apri l'app
  di tanto in tanto — non è affidabile come un'app nativa in background.
- **Nessun widget** sulla schermata Home: richiede un'app nativa (WidgetKit), non disponibile
  per le PWA.
- **HealthKit**: non accessibile da una PWA.
- **Tirocinio**: il calendario APRO integrato copre solo la Linea Gialla, trascritto dal PDF
  ufficiale "Calendario APRO 2026/27". Se cambi linea o il calendario ufficiale viene
  aggiornato, va ritrascritto in `js/tirocinio.js` (struttura semplice: un array di
  settimane con data inizio/fine, attività e gruppo PSD coinvolto).

Se in futuro vorrai la versione nativa con calendario live, widget e notifiche affidabili,
questa PWA è già organizzata (UI separata dalla logica in js/) per essere riscritta 1:1 in
SwiftUI senza dover ripensare da zero le regole (scoring, Exam Mode, Pilates, Esami, ecc.).
