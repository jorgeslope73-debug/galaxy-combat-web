'use strict';
(() => {
  const DATA = {
    es: {
      button:'MANUAL', title:'MANUAL DE JUEGO', subtitle:'Todo lo necesario para pilotar, sobrevivir y ganar en Galaxy Combat.', close:'CERRAR', contents:'CONTENIDO',
      sections:[
        {id:'objective',title:'1. Objetivo y partida',body:[
          'Galaxy Combat es un combate espacial arcade para 1 a 4 jugadores. En partidas online pueden jugar de 2 a 4 personas; también puedes jugar contra la CPU en tres niveles de dificultad.',
          'Gana el primer jugador que alcance 5 bajas. El marcador de cada nave muestra sus bajas respecto al objetivo de la partida. Si varios jugadores empatan en cabeza no hay un líder único hasta que uno se adelante.',
          'Al morir reapareces rápidamente, pero pierdes la munición y las mejoras acumuladas. Al reaparecer dispones de unos segundos de protección para volver a entrar en combate.'
        ],tips:['Muévete siempre: una nave parada es un objetivo fácil.','Las mejoras flotantes pueden cambiar una partida; vigila el centro del escenario además de a tus rivales.']},
        {id:'controls',title:'2. Controles',body:[
          'PC: A / D o flechas izquierda / derecha para girar; W o flecha arriba para acelerar; CTRL o ESPACIO para disparar. ESC sale de la partida.',
          'Móvil: juega en horizontal. La inclinación del teléfono controla el giro y se calibra automáticamente al empezar. Mantén pulsada la zona izquierda para disparar y la derecha para acelerar.',
          'Voz: actívala desde el menú. En PC mantén V para hablar. En móvil aparece un control de voz durante la partida; mantenlo pulsado para transmitir.'
        ],tips:['En móvil, coloca el teléfono en la postura cómoda de juego antes de empezar: esa posición se toma como referencia.','Los controles caducan en el servidor si dejan de llegar, evitando aceleración o giro bloqueados tras una pérdida de conexión.']},
        {id:'hud',title:'3. HUD, bajas y líder',body:[
          'Cada jugador tiene un HUD del mismo color que su nave. Ahí puedes consultar munición, velocidad y bajas. Los jugadores de la izquierda usan el HUD izquierdo y los de la derecha el HUD derecho.',
          'Cuando consigues una baja, el nuevo valor aparece sincronizado con una animación de escala del marcador. Si una muerte ambiental te resta una baja, primero aparece PENALIZACIÓN -1 y después se actualiza el HUD con su efecto.',
          'Cuando existe un líder único aparece un aviso con su nombre. El nombre del líder también pulsa suavemente en su HUD.'
        ]},
        {id:'weapons',title:'4. Munición, disparos y BRUTAL',body:[
          'Empiezas la partida con 1 bala. Cada disparo consume una unidad de munición; recoge cápsulas para seguir atacando.',
          'La mejora de cadencia reduce el tiempo entre disparos. En los niveles avanzados también aumenta la velocidad del proyectil, por lo que un jugador mejorado puede ejercer mucha más presión.',
          'Un impacto de muy larga distancia activa BRUTAL. El juego mide la distancia recorrida por la bala y la muestra en metros, tomando una nave de 8 m como referencia. El umbral actual equivale aproximadamente a 142 m.'
        ],tips:['No malgastes la última bala: sin munición pierdes capacidad ofensiva hasta encontrar otra cápsula.','Las balas desaparecen al salir del escenario y también pueden destruir meteoritos pequeños o eliminar mejoras flotantes.']},
        {id:'pickups',title:'5. Mejoras flotantes',body:[
          'Las mejoras aparecen por el escenario de forma periódica. Puede haber hasta 5 simultáneamente. Cuando la más antigua está a punto de ser sustituida, parpadea durante sus últimos 2 segundos entre 50 % y 100 % de opacidad.',
          'Los asteroides y meteoritos pueden eliminar mejoras al atravesarlas, así que una oportunidad puede desaparecer antes de que llegues.'
        ],pickups:[
          ['ammo1','MUNICIÓN +1','Añade 1 bala a tu reserva.'],['ammo3','MUNICIÓN +3','Añade 3 balas a tu reserva.'],['cadence','CADENCIA','Dispara con mayor frecuencia; los niveles altos también aceleran el proyectil.'],['speed','VELOCIDAD','Aumenta la velocidad de la nave en pasos de +0,5 hasta un máximo de x2.'],['shield','ESCUDO','Protección durante 10 s contra disparos y muchos choques. Una nave protegida puede ser peligrosa en una embestida.'],['camo','INVISIBILIDAD','Solo online. Activa el modo fantasma durante 10 s. Se representa con un ojo tachado.']
        ]},
        {id:'ghost',title:'6. Modo fantasma',body:[
          'La invisibilidad dura 10 segundos y está disponible únicamente en partidas online. Los rivales no ven tu nave de forma continua.',
          'Mientras un jugador está en fantasma aparece junto a su HUD una pastilla semitransparente del color del jugador con el texto FANTASMA. La nave invisible se revela brevemente de forma periódica, aproximadamente cada 4 segundos, para que los rivales puedan volver a localizarla.',
          'Tu propia nave sigue siendo parcialmente visible para ti, para que puedas pilotarla con precisión.'
        ],tips:['Cambia de dirección después de cada revelación para que los rivales no puedan anticipar tu trayectoria.']},
        {id:'hazards',title:'7. Asteroides y meteoritos',body:[
          'Los asteroides grandes forman parte permanente del escenario. Chocar sin protección puede destruir tu nave; con escudo el impacto produce un rebote y efectos de colisión.',
          'La lluvia de meteoritos aparece por primera vez entre 2 y 3 minutos después del inicio. Dura unos 7 segundos. Después, cada nueva lluvia vuelve a esperar un intervalo aleatorio de 2 a 3 minutos.',
          'Los meteoritos pequeños atraviesan el campo, rebotan contra asteroides y contra el meteorito gigante, pueden destruir mejoras flotantes y pueden ser destruidos por disparos.',
          'Además aparece periódicamente un meteorito gigante que cruza el escenario, desplaza asteroides y elimina mejoras que encuentra en su camino.'
        ]},
        {id:'death',title:'8. Muertes, penalizaciones y reaparición',body:[
          'Si otro jugador te destruye, el atacante gana una baja. Si mueres por un peligro del escenario, por choque sin atacante o por una situación equivalente, pierdes 1 baja si tenías alguna; el marcador nunca baja de 0.',
          'Al morir pierdes munición, velocidad mejorada, cadencia mejorada, escudo e invisibilidad. Reapareces con las mejoras reiniciadas y sin munición, por lo que volver a buscar recursos es importante.',
          'Después de reaparecer tienes unos 3 segundos de protección. La protección evita que una mala posición de aparición te elimine inmediatamente.'
        ]},
        {id:'cpu',title:'9. Jugar contra la CPU',body:[
          'Puedes elegir FACIL, MEDIO o DIFICIL. La CPU evita obstáculos y adapta sus prioridades según sus recursos.',
          'Si la CPU no tiene balas ni escudo, no debe perseguirte: busca munición. Si no existe munición disponible, huye e intenta mantener distancia hasta que aparezca.',
          'Si tiene escudo pero no munición, puede intentar embestirte cuando tú no tienes escudo ni protección. Si estás protegido, seguirá buscando recursos o evitando el enfrentamiento. Con balas recupera su comportamiento ofensivo normal.'
        ]},
        {id:'online',title:'10. Online, salas, chat y voz',body:[
          'CREAR PARTIDA permite elegir sala pública o privada. Las públicas aparecen en el navegador de partidas; las privadas se abren mediante su código de 4 caracteres. Cada sala pública muestra la bandera del idioma con el que fue creada.',
          'En el lobby se ven los jugadores conectados y existe chat de texto. El anfitrión inicia la partida cuando hay suficientes jugadores.',
          'La voz usa WebRTC. STUN permite conectar directamente en muchas redes y el juego admite TURN como ruta de respaldo cuando está configurado. Con un máximo de cuatro jugadores se usa una malla P2P.',
          'Si se corta el WebSocket durante una partida, el servidor conserva tu plaza durante unos 30 segundos e intenta recuperar automáticamente la misma nave, puntuación, munición y mejoras.'
        ],tips:['Si cambias de Wi‑Fi a datos móviles, espera unos segundos antes de abandonar: la reconexión automática puede recuperar la partida.','En PC, V funciona como pulsar para hablar; en móvil usa el control de voz de pantalla.']},
        {id:'end',title:'11. Final de partida y revancha',body:[
          'Cuando alguien alcanza 5 bajas aparece la pantalla de victoria. Puedes elegir REPETIR PARTIDA para reiniciar la misma sala con los mismos jugadores, o MENÚ PRINCIPAL para salir.',
          'Al repetir se reinician puntuación, munición, mejoras, meteoritos, asteroides y posiciones. La nueva partida empieza limpia sin necesidad de crear otra sala.'
        ]},
        {id:'pwa',title:'12. Instalar como app',body:[
          'Galaxy Combat es una PWA. En iPhone/iPad abre el juego en Safari, pulsa Compartir y elige Añadir a pantalla de inicio. En Android/Chrome usa Instalar aplicación o Añadir a pantalla de inicio.',
          'Al abrir desde el icono se comporta más como una app, con menos interfaz del navegador. El juego está pensado para pantalla horizontal.',
          'El código principal usa prioridad de red para evitar versiones antiguas, mientras imágenes, sonidos y fuentes se almacenan en caché para acelerar el arranque.'
        ]},
        {id:'tips',title:'13. Consejos de combate',body:[
          'No persigas siempre en línea recta: utiliza asteroides como cobertura y cambia de trayectoria para hacer fallar disparos.',
          'Controla tu munición antes de iniciar una persecución. Un rival desarmado puede ser más vulnerable, pero acercarte sin recursos también te expone a choques y meteoritos.',
          'El escudo no solo sirve para defenderse: puede darte una oportunidad de embestida contra una nave desprotegida.',
          'Las mejoras de velocidad y cadencia hacen que sobrevivir sea más fácil, pero morir las reinicia. A veces es mejor evitar una pelea y conservar la ventaja.'
        ]}
      ]
    },
    en: {
      button:'MANUAL', title:'GAME MANUAL', subtitle:'Everything you need to pilot, survive and win in Galaxy Combat.', close:'CLOSE', contents:'CONTENTS',
      sections:[
        {id:'objective',title:'1. Objective and match',body:['Galaxy Combat is an arcade space combat game for 1 to 4 players. Online matches support 2 to 4 people, and you can also fight the CPU at three difficulty levels.','The first player to reach 5 kills wins. Each ship HUD shows its kills against the match target. If several players are tied for first place, there is no unique leader until someone moves ahead.','After being destroyed you respawn quickly, but you lose ammunition and collected upgrades. After respawning you receive a short protection window to re-enter the fight.'],tips:['Keep moving: a stationary ship is an easy target.','Floating upgrades can swing a match; watch the arena as well as your opponents.']},
        {id:'controls',title:'2. Controls',body:['PC: A / D or Left / Right arrows to turn; W or Up arrow to thrust; CTRL or SPACE to fire. ESC leaves the match.','Mobile: play in landscape. Phone tilt controls turning and is calibrated automatically when the match begins. Hold the left side to fire and the right side to thrust.','Voice: enable it from the main menu. On PC hold V to talk. On mobile a voice control appears during the match; hold it while speaking.'],tips:['On mobile, hold the phone in your comfortable playing position before the match starts: that position becomes the reference.','Server controls expire if updates stop arriving, preventing stuck thrust or turning after a connection issue.']},
        {id:'hud',title:'3. HUD, kills and leader',body:['Each player has a HUD matching their ship color. It shows ammunition, speed and kills. Left-side players use the left HUD; right-side players use the right HUD.','When you score a kill, the new value appears in sync with a large scale animation. If an environmental death costs you a kill, PENALTY -1 appears first and the HUD updates afterward with its effect.','When there is one clear leader, a leader announcement appears. The leader name also pulses gently in the HUD.']},
        {id:'weapons',title:'4. Ammunition, shots and BRUTAL',body:['You start a match with 1 bullet. Every shot consumes one ammo unit; collect capsules to keep attacking.','The fire-rate upgrade reduces the delay between shots. At advanced levels it also increases projectile speed, making an upgraded player much more dangerous.','A very long-range kill triggers BRUTAL. The game measures the distance travelled by the bullet and displays it in metres, using an 8 m ship as the reference. The current threshold is roughly 142 m.'],tips:['Do not waste your last bullet: with no ammo you lose your ranged threat until you find another capsule.','Bullets vanish outside the arena and can also destroy small meteors or remove floating pickups.']},
        {id:'pickups',title:'5. Floating upgrades',body:['Upgrades appear around the arena periodically. Up to 5 can exist at once. When the oldest one is about to be replaced, it blinks during its final 2 seconds between 50% and 100% opacity.','Asteroids and meteors can remove pickups by crossing them, so an opportunity may disappear before you reach it.'],pickups:[['ammo1','AMMO +1','Adds 1 bullet to your reserve.'],['ammo3','AMMO +3','Adds 3 bullets to your reserve.'],['cadence','FIRE RATE','Lets you fire more often; higher levels also speed up projectiles.'],['speed','SPEED','Raises ship speed in +0.5 steps up to x2.'],['shield','SHIELD','Protects for 10 s against shots and many collisions. A shielded ship can be dangerous in a ram.'],['camo','INVISIBILITY','Online only. Activates ghost mode for 10 s. Shown as a crossed-out eye.']]},
        {id:'ghost',title:'6. Ghost mode',body:['Invisibility lasts 10 seconds and is only available in online matches. Opponents cannot see your ship continuously.','While a player is in ghost mode, a semi-transparent pill matching that player color appears beside their HUD with the word GHOST. The invisible ship briefly reveals itself periodically, about every 4 seconds, so opponents can relocate it.','Your own ship remains partially visible to you so you can steer accurately.'],tips:['Change direction after each reveal so opponents cannot predict your path.']},
        {id:'hazards',title:'7. Asteroids and meteors',body:['Large asteroids are permanent arena hazards. Hitting one without protection can destroy your ship; with a shield you bounce away and get an impact effect.','The first meteor shower begins 2 to 3 minutes after the match starts and lasts about 7 seconds. Every later shower waits another random 2 to 3 minute interval.','Small meteors cross the arena, bounce off asteroids and the giant meteor, can destroy floating pickups, and can be destroyed by bullets.','A giant meteor also crosses the arena periodically, pushes asteroids and removes pickups in its path.']},
        {id:'death',title:'8. Deaths, penalties and respawn',body:['If another player destroys you, the attacker gains one kill. If you die to an arena hazard, an uncredited collision or an equivalent event, you lose 1 kill if you had one; the score never drops below 0.','When destroyed you lose ammo, speed upgrades, fire-rate upgrades, shield and invisibility. You respawn with upgrades reset and no ammunition, so rebuilding your resources matters.','After respawning you have about 3 seconds of protection, preventing an unlucky spawn from immediately killing you again.']},
        {id:'cpu',title:'9. Playing against the CPU',body:['Choose EASY, MEDIUM or HARD. The CPU avoids hazards and changes priorities based on its resources.','With no bullets and no shield, the CPU should not chase you: it searches for ammunition. If no ammo pickup exists, it flees and tries to keep its distance until one appears.','With a shield but no bullets, it may try to ram you only when you have no shield or spawn protection. If you are protected it keeps searching or avoiding combat. With bullets it returns to normal offensive behavior.']},
        {id:'online',title:'10. Online, rooms, chat and voice',body:['CREATE GAME lets you choose a public or private room. Public rooms appear in the browser; private rooms are opened with a 4-character code. Each public room shows the flag of the language in which it was created.','The lobby shows connected players and includes text chat. The host starts the match when enough players are present.','Voice uses WebRTC. STUN handles many direct connections and TURN can provide a fallback route when configured. With up to four players, voice uses a P2P mesh.','If the WebSocket drops during a match, the server keeps your slot for about 30 seconds and automatically tries to restore the same ship, score, ammo and upgrades.'],tips:['If you switch from Wi-Fi to mobile data, wait a few seconds before leaving: automatic reconnection may restore the match.','On PC, V is push-to-talk; on mobile use the on-screen voice control.']},
        {id:'end',title:'11. Match end and rematch',body:['When someone reaches 5 kills, the victory screen appears. Choose PLAY AGAIN to reset the same room with the same players, or MAIN MENU to leave.','A rematch resets scores, ammo, upgrades, meteors, asteroids and spawn positions so the new round starts cleanly.']},
        {id:'pwa',title:'12. Install as an app',body:['Galaxy Combat is a PWA. On iPhone/iPad open it in Safari, tap Share and choose Add to Home Screen. On Android/Chrome use Install app or Add to Home screen.','Launching from the icon feels more like an app with less browser chrome. The game is designed for landscape orientation.','Core code uses network-first loading to avoid stale versions, while images, sounds and fonts are cached for faster startup.']},
        {id:'tips',title:'13. Combat tips',body:['Do not always chase in a straight line: use asteroids as cover and vary your path to make shots miss.','Check your ammunition before starting a chase. An unarmed rival is vulnerable, but attacking without resources can expose you to collisions and meteors.','A shield is not only defensive: it can create a ramming opportunity against an unprotected ship.','Speed and fire-rate upgrades are powerful, but dying resets them. Sometimes avoiding a fight is the best way to preserve an advantage.']}
      ]
    },
    it: {
      button:'MANUALE', title:'MANUALE DI GIOCO', subtitle:'Tutto quello che serve per pilotare, sopravvivere e vincere in Galaxy Combat.', close:'CHIUDI', contents:'CONTENUTI',
      sections:[
        {id:'objective',title:'1. Obiettivo e partita',body:['Galaxy Combat è un combattimento spaziale arcade da 1 a 4 giocatori. Online possono giocare da 2 a 4 persone; puoi anche affrontare la CPU con tre livelli di difficoltà.','Vince il primo giocatore che raggiunge 5 eliminazioni. L HUD di ogni nave mostra le eliminazioni rispetto all obiettivo. In caso di parità in testa non esiste un leader unico finché qualcuno non passa avanti.','Dopo la distruzione riappari rapidamente, ma perdi munizioni e potenziamenti. Al respawn hai un breve periodo di protezione per rientrare in combattimento.'],tips:['Resta in movimento: una nave ferma è un bersaglio facile.','I potenziamenti fluttuanti possono cambiare la partita: controlla l arena oltre ai rivali.']},
        {id:'controls',title:'2. Comandi',body:['PC: A / D o frecce sinistra / destra per girare; W o freccia su per accelerare; CTRL o SPAZIO per sparare. ESC esce dalla partita.','Mobile: gioca in orizzontale. L inclinazione del telefono controlla la rotazione e viene calibrata automaticamente all inizio. Tieni premuta la zona sinistra per sparare e la destra per accelerare.','Voce: attivala dal menu. Su PC tieni premuto V per parlare. Su mobile compare un controllo vocale durante la partita; tienilo premuto mentre parli.'],tips:['Su mobile, tieni il telefono nella posizione comoda prima dell inizio: quella posizione diventa il riferimento.','I comandi sul server scadono se smettono di arrivare aggiornamenti, evitando accelerazione o rotazione bloccate.']},
        {id:'hud',title:'3. HUD, eliminazioni e leader',body:['Ogni giocatore ha un HUD dello stesso colore della nave. Mostra munizioni, velocità ed eliminazioni. I giocatori a sinistra usano l HUD sinistro e quelli a destra l HUD destro.','Quando ottieni un eliminazione, il nuovo valore appare insieme a una forte animazione di scala. Se una morte ambientale ti costa un punto, appare prima PENALITÀ -1 e poi si aggiorna l HUD.','Quando esiste un leader unico compare un avviso e il suo nome pulsa leggermente nell HUD.']},
        {id:'weapons',title:'4. Munizioni, colpi e BRUTAL',body:['Inizi con 1 proiettile. Ogni sparo consuma una munizione; raccogli capsule per continuare ad attaccare.','Il potenziamento cadenza riduce il tempo tra i colpi. Ai livelli avanzati aumenta anche la velocità del proiettile.','Un eliminazione da distanza molto lunga attiva BRUTAL. Il gioco misura il percorso del proiettile e lo mostra in metri usando una nave da 8 m come riferimento. La soglia attuale è circa 142 m.'],tips:['Non sprecare l ultima munizione: senza colpi perdi la minaccia a distanza finché non trovi una capsula.','I proiettili spariscono fuori dall arena e possono distruggere meteore piccole o eliminare potenziamenti.']},
        {id:'pickups',title:'5. Potenziamenti fluttuanti',body:['I potenziamenti compaiono periodicamente. Possono essercene fino a 5 contemporaneamente. Quando il più vecchio sta per essere sostituito, lampeggia negli ultimi 2 secondi tra il 50% e il 100% di opacità.','Asteroidi e meteore possono eliminare i potenziamenti attraversandoli.'],pickups:[['ammo1','MUNIZIONI +1','Aggiunge 1 proiettile alla riserva.'],['ammo3','MUNIZIONI +3','Aggiunge 3 proiettili alla riserva.'],['cadence','CADENZA','Permette di sparare più spesso; i livelli alti accelerano anche i proiettili.'],['speed','VELOCITÀ','Aumenta la velocità in passi di +0,5 fino a x2.'],['shield','SCUDO','Protegge per 10 s da colpi e molte collisioni. Una nave protetta può essere pericolosa in una speronata.'],['camo','INVISIBILITÀ','Solo online. Attiva la modalità fantasma per 10 s. È indicata da un occhio barrato.']]},
        {id:'ghost',title:'6. Modalità fantasma',body:['L invisibilità dura 10 secondi ed è disponibile solo online. Gli avversari non vedono la tua nave in modo continuo.','Durante la modalità fantasma compare accanto all HUD una pillola semitrasparente del colore del giocatore con la scritta FANTASMA. La nave invisibile si rivela brevemente circa ogni 4 secondi.','La tua nave resta parzialmente visibile a te per permettere un controllo preciso.'],tips:['Cambia direzione dopo ogni rivelazione per rendere imprevedibile la traiettoria.']},
        {id:'hazards',title:'7. Asteroidi e meteore',body:['Gli asteroidi grandi sono pericoli permanenti. Una collisione senza protezione può distruggerti; con lo scudo rimbalzi e compare un effetto d impatto.','La prima pioggia di meteore inizia tra 2 e 3 minuti e dura circa 7 secondi. Le successive aspettano ogni volta un altro intervallo casuale di 2-3 minuti.','Le meteore piccole attraversano l arena, rimbalzano contro asteroidi e meteorite gigante, possono distruggere potenziamenti e possono essere abbattute dai proiettili.','Un meteorite gigante attraversa periodicamente lo scenario, sposta gli asteroidi ed elimina i potenziamenti sul suo percorso.']},
        {id:'death',title:'8. Morti, penalità e respawn',body:['Se un altro giocatore ti distrugge, l attaccante guadagna un eliminazione. Se muori per un pericolo dello scenario o per una collisione senza attaccante, perdi 1 eliminazione se ne avevi; il punteggio non scende mai sotto 0.','Alla morte perdi munizioni, velocità, cadenza, scudo e invisibilità. Riappari con i potenziamenti azzerati e senza munizioni.','Dopo il respawn hai circa 3 secondi di protezione.']},
        {id:'cpu',title:'9. Giocare contro la CPU',body:['Scegli FACILE, MEDIO o DIFFICILE. La CPU evita gli ostacoli e cambia priorità in base alle risorse.','Senza munizioni e senza scudo non ti insegue: cerca munizioni. Se non ce ne sono, fugge e prova a mantenere le distanze.','Con scudo ma senza munizioni può tentare una speronata solo se tu non hai scudo né protezione. Con munizioni torna al comportamento offensivo.']},
        {id:'online',title:'10. Online, stanze, chat e voce',body:['CREA PARTITA permette di scegliere una stanza pubblica o privata. Le pubbliche compaiono nell elenco; le private si aprono con un codice di 4 caratteri. Ogni stanza pubblica mostra la bandiera della lingua con cui è stata creata.','La lobby mostra i giocatori connessi e include una chat testuale. L host avvia la partita quando ci sono abbastanza giocatori.','La voce usa WebRTC: STUN gestisce molte connessioni dirette e TURN può fornire una via di riserva quando configurato. Con massimo quattro giocatori si usa una mesh P2P.','Se il WebSocket cade durante la partita, il server conserva il posto per circa 30 secondi e tenta di recuperare automaticamente la stessa nave, punteggio, munizioni e potenziamenti.'],tips:['Se passi da Wi-Fi a rete mobile, aspetta qualche secondo prima di uscire: la riconnessione automatica può recuperare la partita.','Su PC V è push-to-talk; su mobile usa il controllo vocale sullo schermo.']},
        {id:'end',title:'11. Fine partita e rivincita',body:['Quando qualcuno raggiunge 5 eliminazioni compare la vittoria. Puoi scegliere RIGIOCA per riavviare la stessa stanza o MENU PRINCIPALE per uscire.','La rivincita azzera punteggi, munizioni, potenziamenti, meteore, asteroidi e posizioni.']},
        {id:'pwa',title:'12. Installare come app',body:['Galaxy Combat è una PWA. Su iPhone/iPad apri il gioco in Safari, premi Condividi e scegli Aggiungi alla schermata Home. Su Android/Chrome usa Installa app o Aggiungi a schermata Home.','Dal suo icono si apre con meno interfaccia del browser. Il gioco è pensato per l orientamento orizzontale.','Il codice principale usa priorità alla rete per evitare versioni obsolete, mentre immagini, suoni e font vengono memorizzati in cache.']},
        {id:'tips',title:'13. Consigli di combattimento',body:['Non inseguire sempre in linea retta: usa gli asteroidi come copertura e varia la traiettoria.','Controlla le munizioni prima di iniziare un inseguimento.','Lo scudo non è solo difensivo: può creare un opportunità di speronata contro una nave senza protezione.','Velocità e cadenza sono potenti, ma la morte le azzera: a volte evitare lo scontro è la scelta migliore.']}
      ]
    },
    fr: {
      button:'MANUEL', title:'MANUEL DE JEU', subtitle:'Tout ce qu il faut pour piloter, survivre et gagner dans Galaxy Combat.', close:'FERMER', contents:'SOMMAIRE',
      sections:[
        {id:'objective',title:'1. Objectif et partie',body:['Galaxy Combat est un jeu de combat spatial arcade pour 1 à 4 joueurs. En ligne, 2 à 4 personnes peuvent jouer; tu peux aussi affronter le CPU avec trois niveaux de difficulté.','Le premier joueur à atteindre 5 éliminations gagne. Le HUD de chaque vaisseau affiche ses éliminations par rapport à l objectif. En cas d égalité en tête, il n y a pas de leader unique.','Après destruction tu réapparais rapidement, mais tu perds munitions et améliorations. Après le respawn tu disposes d une courte protection.'],tips:['Reste en mouvement: un vaisseau immobile est une cible facile.','Les améliorations flottantes peuvent retourner une partie; surveille l arène autant que les adversaires.']},
        {id:'controls',title:'2. Commandes',body:['PC: A / D ou flèches gauche / droite pour tourner; W ou flèche haut pour accélérer; CTRL ou ESPACE pour tirer. ESC quitte la partie.','Mobile: joue en paysage. L inclinaison du téléphone contrôle la rotation et se calibre automatiquement au début. Maintiens la zone gauche pour tirer et la droite pour accélérer.','Voix: active-la depuis le menu. Sur PC maintiens V pour parler. Sur mobile un contrôle vocal apparaît pendant la partie.'],tips:['Sur mobile, tiens le téléphone dans ta position de jeu confortable avant le départ: elle devient la référence.','Les commandes expirent côté serveur si les mises à jour cessent, évitant une accélération ou rotation bloquée.']},
        {id:'hud',title:'3. HUD, éliminations et leader',body:['Chaque joueur possède un HUD de la couleur de son vaisseau. Il indique munitions, vitesse et éliminations.','Quand tu obtiens une élimination, la nouvelle valeur apparaît avec une grande animation d échelle. Si une mort environnementale te retire un point, PÉNALITÉ -1 apparaît avant la mise à jour du HUD.','Lorsqu il existe un leader unique, une annonce apparaît et son nom pulse légèrement dans le HUD.']},
        {id:'weapons',title:'4. Munitions, tirs et BRUTAL',body:['Tu commences avec 1 balle. Chaque tir consomme une munition; récupère des capsules pour continuer à attaquer.','L amélioration de cadence réduit le délai entre les tirs. Aux niveaux avancés elle augmente aussi la vitesse du projectile.','Une élimination à très longue distance déclenche BRUTAL. La distance parcourue par la balle est affichée en mètres en prenant un vaisseau de 8 m comme référence. Le seuil actuel est d environ 142 m.'],tips:['Évite de gaspiller ta dernière balle.','Les tirs disparaissent hors de l arène et peuvent aussi détruire de petites météorites ou supprimer des améliorations flottantes.']},
        {id:'pickups',title:'5. Améliorations flottantes',body:['Les améliorations apparaissent périodiquement. Il peut y en avoir jusqu à 5. Quand la plus ancienne va être remplacée, elle clignote pendant ses 2 dernières secondes entre 50 % et 100 % d opacité.','Astéroïdes et météorites peuvent faire disparaître une amélioration en la traversant.'],pickups:[['ammo1','MUNITIONS +1','Ajoute 1 balle à la réserve.'],['ammo3','MUNITIONS +3','Ajoute 3 balles à la réserve.'],['cadence','CADENCE','Permet de tirer plus souvent; les niveaux élevés accélèrent aussi les projectiles.'],['speed','VITESSE','Augmente la vitesse par pas de +0,5 jusqu à x2.'],['shield','BOUCLIER','Protège pendant 10 s contre les tirs et de nombreuses collisions.'],['camo','INVISIBILITÉ','En ligne uniquement. Active le mode fantôme pendant 10 s. Icône: œil barré.']]},
        {id:'ghost',title:'6. Mode fantôme',body:['L invisibilité dure 10 secondes et n existe qu en ligne. Les adversaires ne voient pas ton vaisseau en continu.','Pendant ce mode, une pastille semi-transparente de la couleur du joueur apparaît près de son HUD avec le texte FANTÔME. Le vaisseau invisible se révèle brièvement environ toutes les 4 secondes.','Ton propre vaisseau reste partiellement visible pour toi.'],tips:['Change de direction après chaque révélation pour rendre ta trajectoire difficile à prévoir.']},
        {id:'hazards',title:'7. Astéroïdes et météorites',body:['Les gros astéroïdes sont des dangers permanents. Sans protection, un choc peut te détruire; avec un bouclier tu rebondis.','La première pluie de météorites commence entre 2 et 3 minutes et dure environ 7 secondes. Les suivantes attendent chacune un nouvel intervalle aléatoire de 2 à 3 minutes.','Les petites météorites traversent l arène, rebondissent sur les astéroïdes et la météorite géante, peuvent supprimer des améliorations et peuvent être détruites par les tirs.','Une météorite géante traverse aussi périodiquement le terrain, pousse les astéroïdes et supprime les améliorations sur son passage.']},
        {id:'death',title:'8. Morts, pénalités et respawn',body:['Si un autre joueur te détruit, il gagne une élimination. Si tu meurs à cause du décor ou d une collision sans attaquant, tu perds 1 élimination si tu en avais; le score ne descend jamais sous 0.','À la mort tu perds munitions, vitesse améliorée, cadence, bouclier et invisibilité. Tu réapparais sans munition et avec les améliorations réinitialisées.','Après le respawn tu disposes d environ 3 secondes de protection.']},
        {id:'cpu',title:'9. Jouer contre le CPU',body:['Choisis FACILE, MOYEN ou DIFFICILE. Le CPU évite les obstacles et change de priorité selon ses ressources.','Sans munitions ni bouclier, il ne te poursuit pas: il cherche des munitions. S il n y en a pas, il fuit et garde ses distances.','Avec un bouclier mais sans munitions, il peut tenter de te percuter seulement si tu n as ni bouclier ni protection. Avec des balles il reprend son comportement offensif.']},
        {id:'online',title:'10. En ligne, salles, chat et voix',body:['CRÉER UNE PARTIE permet de choisir une salle publique ou privée. Les publiques apparaissent dans la liste; les privées s ouvrent avec un code de 4 caractères. Chaque salle publique affiche le drapeau de la langue de création.','Le lobby affiche les joueurs connectés et un chat texte. L hôte lance la partie lorsqu il y a assez de joueurs.','La voix utilise WebRTC. STUN permet de nombreuses connexions directes et TURN peut servir de route de secours. Jusqu à quatre joueurs utilisent un maillage P2P.','Si le WebSocket tombe pendant une partie, le serveur conserve ta place environ 30 secondes et tente de récupérer automatiquement le même vaisseau, score, munitions et améliorations.'],tips:['Si tu passes du Wi-Fi aux données mobiles, attends quelques secondes avant de quitter.','Sur PC, V est le push-to-talk; sur mobile utilise le contrôle vocal à l écran.']},
        {id:'end',title:'11. Fin de partie et revanche',body:['Quand quelqu un atteint 5 éliminations, l écran de victoire apparaît. Choisis REJOUER pour relancer la même salle ou MENU PRINCIPAL pour quitter.','La revanche réinitialise scores, munitions, améliorations, météorites, astéroïdes et positions.']},
        {id:'pwa',title:'12. Installer comme application',body:['Galaxy Combat est une PWA. Sur iPhone/iPad ouvre le jeu dans Safari, touche Partager puis Sur l écran d accueil. Sur Android/Chrome utilise Installer l application ou Ajouter à l écran d accueil.','Depuis l icône le jeu ressemble davantage à une app et utilise moins d interface navigateur. Le mode paysage est recommandé.','Le code principal privilégie le réseau pour éviter les anciennes versions; images, sons et polices restent en cache pour accélérer le démarrage.']},
        {id:'tips',title:'13. Conseils de combat',body:['Ne poursuis pas toujours en ligne droite: utilise les astéroïdes comme couverture et varie ta trajectoire.','Vérifie tes munitions avant de poursuivre un rival.','Le bouclier peut aussi servir offensivement pour une collision contre un vaisseau non protégé.','Vitesse et cadence sont puissantes, mais la mort les réinitialise: préserver un avantage peut valoir mieux qu un duel risqué.']}
      ]
    },
    de: {
      button:'ANLEITUNG', title:'SPIELANLEITUNG', subtitle:'Alles, was du zum Fliegen, Überleben und Gewinnen in Galaxy Combat brauchst.', close:'SCHLIESSEN', contents:'INHALT',
      sections:[
        {id:'objective',title:'1. Ziel und Spiel',body:['Galaxy Combat ist ein Arcade-Weltraumkampf für 1 bis 4 Spieler. Online spielen 2 bis 4 Personen; außerdem kannst du gegen die CPU in drei Schwierigkeitsstufen antreten.','Wer zuerst 5 Abschüsse erreicht, gewinnt. Das HUD jedes Schiffs zeigt die Abschüsse im Verhältnis zum Spielziel. Bei Gleichstand gibt es keinen eindeutigen Anführer.','Nach der Zerstörung spawnst du schnell neu, verlierst aber Munition und gesammelte Verbesserungen. Nach dem Respawn erhältst du kurzzeitig Schutz.'],tips:['Bleib in Bewegung: ein stehendes Schiff ist ein leichtes Ziel.','Schwebende Verbesserungen können ein Spiel drehen; beobachte die Arena ebenso wie deine Gegner.']},
        {id:'controls',title:'2. Steuerung',body:['PC: A / D oder Pfeil links / rechts zum Drehen; W oder Pfeil hoch zum Beschleunigen; CTRL oder LEERTASTE zum Feuern. ESC verlässt das Spiel.','Mobil: spiele im Querformat. Die Neigung des Telefons steuert die Drehung und wird beim Spielstart automatisch kalibriert. Linke Bildschirmhälfte halten zum Feuern, rechte zum Beschleunigen.','Sprache: im Hauptmenü aktivieren. Auf PC V gedrückt halten zum Sprechen. Mobil erscheint während des Spiels eine Sprechtaste.'],tips:['Halte das Telefon vor dem Start in deiner bequemen Spielposition; diese wird als Referenz genommen.','Serverseitige Steuerbefehle laufen aus, wenn keine Updates mehr eintreffen, damit Schub oder Drehung nicht hängen bleiben.']},
        {id:'hud',title:'3. HUD, Abschüsse und Führung',body:['Jeder Spieler hat ein HUD in der Farbe seines Schiffs. Es zeigt Munition, Geschwindigkeit und Abschüsse.','Bei einem Abschuss erscheint der neue Wert synchron mit einer großen Skalierungsanimation. Kostet dich ein Umwelttod einen Punkt, erscheint zuerst STRAFE -1 und danach aktualisiert sich das HUD.','Gibt es einen eindeutigen Anführer, erscheint eine Meldung und sein Name pulsiert leicht im HUD.']},
        {id:'weapons',title:'4. Munition, Schüsse und BRUTAL',body:['Du startest mit 1 Schuss. Jeder Schuss verbraucht eine Munition; sammle Kapseln, um weiter angreifen zu können.','Die Feuerraten-Verbesserung verkürzt die Zeit zwischen Schüssen. Höhere Stufen erhöhen zusätzlich die Projektilgeschwindigkeit.','Ein Abschuss aus sehr großer Entfernung löst BRUTAL aus. Die Flugstrecke der Kugel wird in Metern angezeigt, wobei ein 8-m-Schiff als Referenz dient. Die aktuelle Schwelle liegt bei etwa 142 m.'],tips:['Verschwende nicht deine letzte Kugel.','Kugeln verschwinden außerhalb der Arena und können kleine Meteore zerstören oder schwebende Verbesserungen entfernen.']},
        {id:'pickups',title:'5. Schwebende Verbesserungen',body:['Verbesserungen erscheinen regelmäßig. Maximal 5 können gleichzeitig vorhanden sein. Wenn die älteste gleich ersetzt wird, blinkt sie in den letzten 2 Sekunden zwischen 50 % und 100 % Deckkraft.','Asteroiden und Meteore können Verbesserungen beim Durchqueren zerstören.'],pickups:[['ammo1','MUNITION +1','Fügt 1 Schuss hinzu.'],['ammo3','MUNITION +3','Fügt 3 Schüsse hinzu.'],['cadence','FEUERRATE','Erlaubt häufigeres Feuern; hohe Stufen machen Projektile zusätzlich schneller.'],['speed','GESCHWINDIGKEIT','Erhöht die Schiffsgeschwindigkeit in +0,5-Schritten bis x2.'],['shield','SCHILD','Schützt 10 s lang vor Schüssen und vielen Kollisionen.'],['camo','UNSICHTBARKEIT','Nur online. Aktiviert 10 s lang den Geistmodus. Symbol: durchgestrichenes Auge.']]},
        {id:'ghost',title:'6. Geistmodus',body:['Unsichtbarkeit dauert 10 Sekunden und gibt es nur online. Gegner sehen dein Schiff nicht dauerhaft.','Im Geistmodus erscheint neben dem HUD eine halbtransparente Kapsel in Spielerfarbe mit dem Text GEIST. Das unsichtbare Schiff wird ungefähr alle 4 Sekunden kurz sichtbar.','Das eigene Schiff bleibt für den Spieler teilweise sichtbar, damit es präzise steuerbar bleibt.'],tips:['Ändere nach jeder Sichtbarkeit deine Richtung, damit Gegner die Flugbahn schlechter vorhersagen können.']},
        {id:'hazards',title:'7. Asteroiden und Meteore',body:['Große Asteroiden sind permanente Gefahren. Ohne Schutz kann eine Kollision das Schiff zerstören; mit Schild prallst du ab.','Der erste Meteorschauer beginnt nach 2 bis 3 Minuten und dauert etwa 7 Sekunden. Danach wartet jeder neue Schauer erneut zufällig 2 bis 3 Minuten.','Kleine Meteore fliegen durch die Arena, prallen an Asteroiden und dem Riesenmeteor ab, können Verbesserungen zerstören und können abgeschossen werden.','Zusätzlich zieht regelmäßig ein Riesenmeteor durch die Arena, verschiebt Asteroiden und entfernt Verbesserungen auf seinem Weg.']},
        {id:'death',title:'8. Tode, Strafen und Respawn',body:['Zerstört dich ein anderer Spieler, erhält der Angreifer einen Abschuss. Stirbst du durch eine Arenagefahr oder eine Kollision ohne Angreifer, verlierst du 1 Abschuss, falls du einen hattest; der Wert fällt nie unter 0.','Beim Tod verlierst du Munition, Geschwindigkeits- und Feuerratenverbesserungen, Schild und Unsichtbarkeit. Du spawnst ohne Munition und mit zurückgesetzten Verbesserungen.','Nach dem Respawn bist du ungefähr 3 Sekunden geschützt.']},
        {id:'cpu',title:'9. Gegen die CPU',body:['Wähle EINFACH, MITTEL oder SCHWER. Die CPU vermeidet Hindernisse und ändert ihre Prioritäten abhängig von ihren Ressourcen.','Ohne Munition und Schild verfolgt sie dich nicht: sie sucht Munition. Gibt es keine, flieht sie und versucht Abstand zu halten.','Mit Schild aber ohne Munition kann sie dich rammen, wenn du weder Schild noch Spawn-Schutz hast. Mit Munition kehrt sie zu ihrem offensiven Verhalten zurück.']},
        {id:'online',title:'10. Online, Räume, Chat und Sprache',body:['SPIEL ERSTELLEN bietet öffentliche oder private Räume. Öffentliche Räume erscheinen in der Liste; private werden mit einem 4-stelligen Code geöffnet. Jeder öffentliche Raum zeigt die Flagge der Sprache, in der er erstellt wurde.','Die Lobby zeigt verbundene Spieler und enthält Textchat. Der Host startet das Spiel, sobald genug Spieler da sind.','Sprache nutzt WebRTC. STUN ermöglicht viele Direktverbindungen und TURN kann als Ausweichroute dienen. Bis zu vier Spieler nutzen ein P2P-Mesh.','Fällt der WebSocket während einer Partie aus, hält der Server deinen Platz etwa 30 Sekunden frei und versucht automatisch dasselbe Schiff, Punktestand, Munition und Verbesserungen wiederherzustellen.'],tips:['Beim Wechsel von WLAN zu mobilen Daten einige Sekunden warten, bevor du das Spiel verlässt.','Auf PC ist V Push-to-talk; mobil nutzt du die Sprechtaste auf dem Bildschirm.']},
        {id:'end',title:'11. Spielende und Revanche',body:['Erreicht jemand 5 Abschüsse, erscheint der Sieg-Bildschirm. Wähle NOCHMAL SPIELEN für dieselbe Runde mit denselben Spielern oder HAUPTMENÜ zum Verlassen.','Die Revanche setzt Punkte, Munition, Verbesserungen, Meteore, Asteroiden und Spawnpositionen zurück.']},
        {id:'pwa',title:'12. Als App installieren',body:['Galaxy Combat ist eine PWA. Auf iPhone/iPad in Safari öffnen, Teilen tippen und Zum Home-Bildschirm wählen. Auf Android/Chrome App installieren oder Zum Startbildschirm hinzufügen verwenden.','Vom Icon gestartet wirkt das Spiel stärker wie eine App und zeigt weniger Browser-Oberfläche. Querformat ist vorgesehen.','Der Hauptcode wird bevorzugt aus dem Netz geladen, um veraltete Versionen zu vermeiden; Bilder, Sounds und Schriften werden für schnelleren Start gecacht.']},
        {id:'tips',title:'13. Kampftipps',body:['Verfolge Gegner nicht immer geradlinig: nutze Asteroiden als Deckung und variiere deine Flugbahn.','Prüfe deine Munition, bevor du eine Verfolgung startest.','Ein Schild ist nicht nur defensiv: gegen ein ungeschütztes Schiff kann er eine Rammchance eröffnen.','Geschwindigkeit und Feuerrate sind stark, werden beim Tod aber zurückgesetzt. Manchmal ist Ausweichen besser als ein riskanter Kampf.']}
      ]
    }
  };

  const menu=document.getElementById('menu');
  const dialog=document.getElementById('manualDialog');
  const openButton=document.getElementById('manualOpen');
  const closeButton=document.getElementById('manualClose');
  const titleEl=document.getElementById('manualTitle');
  const subtitleEl=document.getElementById('manualSubtitle');
  const navEl=document.getElementById('manualNav');
  const contentEl=document.getElementById('manualContent');
  let currentSection='objective';

  function language(){
    const lang=window.GalaxyI18n&&window.GalaxyI18n.getLanguage?window.GalaxyI18n.getLanguage():'es';
    return DATA[lang]?lang:'es';
  }
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function pickupIcon(kind){
    if(kind==='ammo1')return '<img src="assets/sprites/municion1.png" alt="" loading="lazy">';
    if(kind==='ammo3')return '<img src="assets/sprites/municion3.png" alt="" loading="lazy">';
    if(kind==='cadence')return '<img src="assets/sprites/cadencia.png" alt="" loading="lazy">';
    if(kind==='speed')return '<img src="assets/sprites/velocidad.png" alt="" loading="lazy">';
    if(kind==='shield')return '<span class="manual-vector-icon manual-shield-icon" aria-hidden="true"></span>';
    return '<span class="manual-vector-icon manual-eye-icon" aria-hidden="true"><i></i></span>';
  }
  function renderButton(){
    const copy=DATA[language()];
    if(!copy)return;
    openButton.textContent=copy.button;
    openButton.setAttribute('aria-label',copy.title);
  }
  function renderFull(){
    const copy=DATA[language()];
    if(!copy)return;
    renderButton();
    titleEl.textContent=copy.title;
    navEl.setAttribute('aria-label',copy.contents);
    subtitleEl.textContent=copy.subtitle;
    closeButton.setAttribute('aria-label',copy.close);
    closeButton.title=copy.close;
    const valid=copy.sections.some(s=>s.id===currentSection);
    if(!valid)currentSection=copy.sections[0].id;
    navEl.innerHTML='<div class="manual-nav-label">'+escapeHtml(copy.contents)+'</div>'+copy.sections.map(section=>
      '<button type="button" data-manual-section="'+section.id+'" class="'+(section.id===currentSection?'active':'')+'">'+escapeHtml(section.title)+'</button>'
    ).join('');
    contentEl.innerHTML=copy.sections.map(section=>{
      const body=section.body.map(p=>'<p>'+escapeHtml(p)+'</p>').join('');
      const tips=section.tips&&section.tips.length?'<div class="manual-tips">'+section.tips.map(t=>'<div><span aria-hidden="true">✦</span><p>'+escapeHtml(t)+'</p></div>').join('')+'</div>':'';
      const pickups=section.pickups?'<div class="manual-pickup-grid">'+section.pickups.map(([kind,name,desc])=>'<article class="manual-pickup"><div class="manual-pickup-icon">'+pickupIcon(kind)+'</div><div><h4>'+escapeHtml(name)+'</h4><p>'+escapeHtml(desc)+'</p></div></article>').join('')+'</div>':'';
      return '<section id="manual-'+section.id+'" class="manual-section" data-section="'+section.id+'"><h3>'+escapeHtml(section.title)+'</h3>'+body+pickups+tips+'</section>';
    }).join('');
    bindNav();
  }
  function bindNav(){
    navEl.querySelectorAll('[data-manual-section]').forEach(button=>button.addEventListener('click',()=>{
      currentSection=button.dataset.manualSection;
      navEl.querySelectorAll('[data-manual-section]').forEach(b=>b.classList.toggle('active',b===button));
      const target=document.getElementById('manual-'+currentSection);
      if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }
  function open(){
    const languageDropdown=document.getElementById('languageDropdown');
    if(languageDropdown)languageDropdown.open=false;
    renderFull();
    dialog.classList.remove('hidden');
    document.documentElement.classList.add('manual-visible');
    contentEl.scrollTop=0;
    requestAnimationFrame(()=>closeButton.focus());
  }
  function close(){
    dialog.classList.add('hidden');
    document.documentElement.classList.remove('manual-visible');
    navEl.innerHTML='';
    contentEl.innerHTML='';
    if(openButton&&menu&&!menu.classList.contains('hidden'))openButton.focus();
  }

  openButton?.addEventListener('click',open);
  closeButton?.addEventListener('click',close);
  dialog?.addEventListener('pointerdown',e=>{if(e.target===dialog)close();});
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&dialog&&!dialog.classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();close();}
  },true);
  window.addEventListener('galaxy-languagechange',()=>{
    renderButton();
    if(dialog&&!dialog.classList.contains('hidden'))renderFull();
  });
  renderButton();
})();
