// ------------------------------------------------------------
// Telas completas da aplicação
// ------------------------------------------------------------
function PomodoroMode({ subjects, cards, settings, todaySessionCount = 0, onDone, onComplete, onSaveSettings, onCardResult }) {
  const MODES = { focus: { label: 'FOCO', key: 'focusDuration', color: 'var(--g)' }, short: { label: 'PAUSA CURTA', key: 'shortBreak', color: 'var(--cyn)' }, long: { label: 'PAUSA LONGA', key: 'longBreak', color: 'var(--yel)' } };
  const [timerMode, setTimerMode] = React.useState('focus');
  const [subject, setSubject] = React.useState(subjects[0] || '');
  const [task, setTask] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(settings.focusDuration * 60);
  const [sessionCount, setSessionCount] = React.useState(todaySessionCount || 0);
  const [showSettings, setShowSettings] = React.useState(false);
  const [localSettings, setLocalSettings] = React.useState({ ...settings });
  const [flash, setFlash] = React.useState(false);
  const [notifyStatus, setNotifyStatus] = React.useState(() => 'Notification' in window ? Notification.permission : 'unsupported');
  const [pomoCardId, setPomoCardId] = React.useState(null);
  const [pomoFlipped, setPomoFlipped] = React.useState(false);
  const [pomoAnsweredIds, setPomoAnsweredIds] = React.useState([]);
  const intervalRef = React.useRef(null);
  const workerRef = React.useRef(null);
  const wakeLockRef = React.useRef(null);
  const deadlineRef = React.useRef(null);
  const startedAtRef = React.useRef(null);
  const elapsedRef = React.useRef(0);
  const lastSavedElapsedRef = React.useRef(0);

  const getDur = (mode, s) => ({ focus: s.focusDuration, short: s.shortBreak, long: s.longBreak })[mode] * 60;
  React.useEffect(() => { if (!running) setSessionCount(todaySessionCount || 0); }, [todaySessionCount, running]);

  const requestNotifications = async () => {
    if (!('Notification' in window)) { setNotifyStatus('unsupported'); return false; }
    if (Notification.permission === 'granted') { setNotifyStatus('granted'); return true; }
    if (Notification.permission === 'denied') { setNotifyStatus('denied'); return false; }
    const permission = await Notification.requestPermission();
    setNotifyStatus(permission);
    return permission === 'granted';
  };
  const notifyPomodoro = (title, body) => {
    if (!('Notification' in window)) { setNotifyStatus('unsupported'); return; }
    setNotifyStatus(Notification.permission);
    if (Notification.permission !== 'granted') return;
    try { new Notification(title, { body, tag: 'flashcards-pomodoro', renotify: true, silent: false, requireInteraction: true }); } catch {}
  };
  const startTimerPulse = onTick => {
    stopTimerPulse();
    if (window.Worker) {
      const code = 'let id=null;self.onmessage=e=>{if(e.data==="start"){clearInterval(id);id=setInterval(()=>self.postMessage("tick"),250);self.postMessage("tick");}if(e.data==="stop"){clearInterval(id);id=null;}}';
      const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = onTick;
      worker.postMessage('start');
      workerRef.current = worker;
      return;
    }
    intervalRef.current = setInterval(onTick, 250);
    onTick();
  };
  const stopTimerPulse = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (workerRef.current) { workerRef.current.postMessage('stop'); workerRef.current.terminate(); workerRef.current = null; }
  };
  const requestWakeLock = async () => {
    try { if ('wakeLock' in navigator && !wakeLockRef.current) wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
  };
  const releaseWakeLock = async () => {
    try { if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; } } catch { wakeLockRef.current = null; }
  };

  const switchMode = (m, s = localSettings) => {
    stopTimerPulse(); releaseWakeLock();
    deadlineRef.current = null; startedAtRef.current = null;
    if (timerMode === 'focus') {
      const elapsed = elapsedRef.current - lastSavedElapsedRef.current;
      const mins = Math.floor(elapsed / 60);
      if (mins >= 1) { onComplete(subject, 0, mins); lastSavedElapsedRef.current = elapsedRef.current; }
    }
    setTimerMode(m); setRunning(false); setTimeLeft(getDur(m, s));
    elapsedRef.current = 0; lastSavedElapsedRef.current = 0;
  };

  const handleRunningToggle = async () => {
    if (running && timerMode === 'focus') {
      if (startedAtRef.current) { elapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000); startedAtRef.current = null; }
      const elapsed = elapsedRef.current - lastSavedElapsedRef.current;
      const mins = Math.floor(elapsed / 60);
      if (mins >= 1) { onComplete(subject, 0, mins); lastSavedElapsedRef.current = elapsedRef.current; }
    }
    if (!running) {
      await requestNotifications();
      await requestWakeLock();
      deadlineRef.current = Date.now() + timeLeft * 1000;
      if (timerMode === 'focus') startedAtRef.current = Date.now();
      setRunning(true);
    } else {
      deadlineRef.current = null;
      await releaseWakeLock();
      setRunning(false);
    }
  };

  React.useEffect(() => {
    if (!running) { stopTimerPulse(); releaseWakeLock(); return; }
    if (!deadlineRef.current) deadlineRef.current = Date.now() + timeLeft * 1000;
    if (timerMode === 'focus' && !startedAtRef.current) startedAtRef.current = Date.now();
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(next);
      if (next <= 0) {
        if (timerMode === 'focus' && startedAtRef.current) { elapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000); startedAtRef.current = null; }
        clearInterval(intervalRef.current); setRunning(false);
        setFlash(true); setTimeout(() => setFlash(false), 2000);
        if (timerMode === 'focus') {
          const nc = sessionCount + 1; setSessionCount(nc);
          const elapsed = elapsedRef.current - lastSavedElapsedRef.current;
          const mins = Math.max(1, Math.floor(elapsed / 60));
          onComplete(subject, 1, mins);
          lastSavedElapsedRef.current = elapsedRef.current;
          const nextMode = nc % localSettings.longBreakInterval === 0 ? 'long' : 'short';
          notifyPomodoro('Pomodoro concluido', `Foco finalizado em ${subject || 'Geral'}. Proximo: ${MODES[nextMode].label}.`);
          switchMode(nextMode);
        } else {
          notifyPomodoro('Pausa concluida', 'Hora de voltar para o foco.');
          switchMode('focus');
        }
      }
    };
    requestWakeLock();
    startTimerPulse(tick);
    return () => stopTimerPulse();
  }, [running, timerMode, sessionCount, subject, localSettings]);

  React.useEffect(() => {
    if (running) { const m = String(Math.floor(timeLeft / 60)).padStart(2, '0'), s = String(timeLeft % 60).padStart(2, '0'); document.title = `${m}:${s} - ${MODES[timerMode].label}`; }
    else document.title = 'FlashCards Terminal';
    return () => { document.title = 'FlashCards Terminal'; };
  }, [running, timeLeft, timerMode]);

  React.useEffect(() => {
    const syncClock = () => { if (running && deadlineRef.current) setTimeLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))); };
    document.addEventListener('visibilitychange', syncClock);
    window.addEventListener('focus', syncClock);
    return () => { document.removeEventListener('visibilitychange', syncClock); window.removeEventListener('focus', syncClock); };
  }, [running]);

  const saveSettings = () => { onSaveSettings(localSettings); switchMode(timerMode, localSettings); setShowSettings(false); };
  const flashcardMode = localSettings.flashcardMode || 'due';
  const rawPomoCards = React.useMemo(() => cards.filter(c => c.subject === subject && (flashcardMode === 'all' || isDue(c))), [cards, subject, flashcardMode]);
  const pomoCards = React.useMemo(() => flashcardMode === 'all' ? rawPomoCards.filter(c => !pomoAnsweredIds.includes(c.id)) : rawPomoCards, [rawPomoCards, flashcardMode, pomoAnsweredIds]);
  const pomoCard = pomoCards.find(c => c.id === pomoCardId) || pomoCards[0] || null;
  const pomoIntervals = pomoCard ? nextIntervals(pomoCard) : null;
  const isFreeTraining = flashcardMode === 'all';
  React.useEffect(() => { setPomoCardId(null); setPomoFlipped(false); setPomoAnsweredIds([]); }, [subject, flashcardMode]);
  React.useEffect(() => { if (!pomoCard && pomoCards.length) { setPomoCardId(pomoCards[0].id); setPomoFlipped(false); } }, [pomoCard, pomoCards]);

  const answerPomodoroCard = grade => {
    if (!pomoCard) return;
    const idx = pomoCards.findIndex(c => c.id === pomoCard.id);
    const next = pomoCards[(idx + 1) % pomoCards.length];
    if (isFreeTraining) setPomoAnsweredIds(ids => ids.includes(pomoCard.id) ? ids : [...ids, pomoCard.id]);
    else onCardResult(pomoCard.id, grade);
    setPomoCardId(next && next.id !== pomoCard.id ? next.id : null);
    setPomoFlipped(false);
  };

  const mobile = useMobile();
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0'), secs = String(timeLeft % 60).padStart(2, '0');
  const modeColor = MODES[timerMode].color;
  const progress = ((getDur(timerMode, localSettings) - timeLeft) / getDur(timerMode, localSettings)) * 100;
  const dotsFilled = sessionCount % localSettings.longBreakInterval;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: flash ? '#002f0a' : 'var(--bg)', transition: 'background .3s', animation: 'up .2s ease' }}>
      <div style={{ padding: mobile ? '8px 12px' : '11px 22px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg2)', flexShrink: 0, flexWrap: 'wrap' }}>
        <TBtn onClick={onDone} color="muted" sm>[ SAIR ]</TBtn>
        {!mobile && <span style={{ color: 'var(--mu)', fontSize: '12px' }}>user@fc:~/pomodoro$</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: mobile ? '4px' : '8px' }}>
          {Array.from({ length: localSettings.longBreakInterval }).map((_, i) => (
            <div key={i} style={{ width: mobile ? '8px' : '10px', height: mobile ? '8px' : '10px', border: `1px solid ${modeColor}`, background: i < dotsFilled ? modeColor : 'transparent', transition: 'background .2s' }} />
          ))}
          <span style={{ color: 'var(--mu)', fontSize: '11px', marginLeft: '4px' }}>{sessionCount}x</span>
        </div>
        <TBtn onClick={() => setShowSettings(s => !s)} color="muted" sm>[ CONFIG ]</TBtn>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: mobile ? '20px 14px' : '32px', gap: '20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {Object.entries(MODES).map(([k, v]) => (
              <button key={k} onClick={() => switchMode(k)} style={{ border: `1px solid ${timerMode === k ? v.color : 'var(--bd)'}`, color: timerMode === k ? v.color : 'var(--mu)', background: 'transparent', padding: '5px 16px', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.06em', transition: 'all .15s' }}>{v.label}</button>
            ))}
          </div>
          <div style={{ width: '100%', maxWidth: '460px' }}>
            <div style={{ height: '2px', background: 'var(--bd)', marginBottom: '30px' }}><div style={{ height: '100%', width: `${progress}%`, background: modeColor, transition: 'width 1s linear' }} /></div>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: mobile ? '72px' : '96px', fontWeight: 700, letterSpacing: '0.06em', color: modeColor, lineHeight: 1, animation: running ? `${timerMode === 'focus' ? 'pomopulse' : 'cpulse'} 2s ease-in-out infinite` : 'none' }}>
                {mins}<span style={{ opacity: running && timeLeft % 2 === 0 ? 0.25 : 1, transition: 'opacity .1s' }}>:</span>{secs}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--mu)', marginTop: '8px', letterSpacing: '0.1em' }}>{MODES[timerMode].label} - {localSettings[MODES[timerMode].key]} min</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
              <TBtn onClick={handleRunningToggle} color={timerMode === 'focus' ? 'green' : timerMode === 'short' ? 'cyan' : 'yellow'}>{running ? '[ PAUSAR ]' : '[ INICIAR ]'}</TBtn>
              <TBtn onClick={() => switchMode(timerMode)} color="muted">[ RESET ]</TBtn>
              {timerMode !== 'focus' && <TBtn onClick={() => switchMode('focus')} color="muted" sm>[ PULAR ]</TBtn>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '10px', color: notifyStatus === 'granted' ? 'var(--cyn)' : notifyStatus === 'denied' ? 'var(--red)' : 'var(--mu)', letterSpacing: '0.08em', marginTop: '-14px', marginBottom: '18px' }}>
              <span>NOTIFICACOES: {notifyStatus === 'granted' ? 'ATIVAS' : notifyStatus === 'denied' ? 'BLOQUEADAS' : notifyStatus === 'unsupported' ? 'INDISPONIVEIS' : 'PEDIR AO INICIAR'}</span>
              <button onClick={async () => { const ok = await requestNotifications(); if (ok) notifyPomodoro('Teste de notificacao', 'Se voce viu isto, as notificacoes do navegador estao funcionando.'); }} style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--mu)', fontSize: '10px', padding: '2px 8px', cursor: 'pointer', letterSpacing: '0.05em' }}>[ TESTAR ]</button>
            </div>
            <div style={{ border: '1px solid var(--bd)', background: 'var(--bg2)', padding: '16px 18px' }}>
              <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.12em', marginBottom: '10px' }}>O QUE VOU ESTUDAR</div>
              <div style={{ marginBottom: '10px' }}><TSelect value={subject} onChange={setSubject} options={subjects.length ? subjects : ['Geral']} /></div>
              <input value={task} onChange={e => setTask(e.target.value)} placeholder="descreva a tarefa (opcional)..." style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--bd)', color: 'var(--wh)', fontSize: '13px', padding: '4px 0', outline: 'none', width: '100%', caretColor: 'var(--g)' }} />
            </div>
            {running && timerMode === 'focus' && (
              <div style={{ border: '1px solid var(--bd)', background: 'var(--bg2)', padding: '16px 18px', marginTop: '14px', animation: 'up .15s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.12em' }}>{isFreeTraining ? 'TREINO LIVRE DO ASSUNTO' : 'REVISAO DO ASSUNTO'}</div>
                    <div style={{ fontSize: '9px', color: 'var(--gm)', marginTop: '4px', letterSpacing: '0.06em' }}>{isFreeTraining ? 'respostas nao alteram revisao' : 'respostas contam no historico'}</div>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--yel)' }}>{isFreeTraining ? `${pomoCards.length} restantes` : `${pomoCards.length} para revisar`}</div>
                </div>
                {!pomoCard ? (
                  <div style={{ fontSize: '12px', color: 'var(--mu)', lineHeight: 1.6, padding: '18px 4px' }}>{isFreeTraining ? 'Todos os flashcards deste assunto foram vistos neste treino livre.' : 'Nenhum flashcard deste assunto esta disponivel para revisar agora.'}</div>
                ) : (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--mu)', marginBottom: '8px' }}>{pomoCard.subject} - {pomoFlipped ? 'RESPOSTA' : 'PERGUNTA'}</div>
                    <div onClick={() => !pomoFlipped && setPomoFlipped(true)} style={{ border: `1px solid ${pomoFlipped ? 'var(--gm)' : 'var(--bdb)'}`, background: pomoFlipped ? 'var(--gf)' : 'var(--bg3)', padding: '22px', minHeight: '120px', cursor: pomoFlipped ? 'default' : 'pointer', display: 'flex', alignItems: 'center', position: 'relative' }}>
                      {!pomoFlipped && <div style={{ position: 'absolute', bottom: '8px', right: '10px', fontSize: '10px', color: 'var(--mu)' }}>[ clique para revelar ]</div>}
                      {pomoFlipped ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
                          <div style={{ borderBottom: '1px solid var(--bd)', paddingBottom: '14px' }}>
                            <div style={{ fontSize: '9px', color: 'var(--mu)', letterSpacing: '0.1em', marginBottom: '8px' }}>PERGUNTA</div>
                            <CardContent text={pomoCard.front} image={pomoCard.frontImage} color="var(--g)" fontSize="13px" />
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', color: 'var(--mu)', letterSpacing: '0.1em', marginBottom: '8px' }}>RESPOSTA</div>
                            <CardContent text={pomoCard.back} image={pomoCard.backImage} color="var(--wh)" />
                          </div>
                        </div>
                      ) : <CardContent text={pomoCard.front} image={pomoCard.frontImage} color="var(--g)" />}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                      {pomoFlipped ? <>
                        <TBtn onClick={() => answerPomodoroCard('again')} color="red" sm>[ AGAIN {pomoIntervals.again} ]</TBtn>
                        <TBtn onClick={() => answerPomodoroCard('hard')} color="yellow" sm>[ HARD {pomoIntervals.hard} ]</TBtn>
                        <TBtn onClick={() => answerPomodoroCard('good')} color="green" sm>[ GOOD {pomoIntervals.good} ]</TBtn>
                        <TBtn onClick={() => answerPomodoroCard('easy')} color="cyan" sm>[ EASY {pomoIntervals.easy} ]</TBtn>
                      </> : <TBtn onClick={() => setPomoFlipped(true)} color="cyan" sm>[ REVELAR ]</TBtn>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {showSettings && (
          <div style={mobile ? { position: 'absolute', inset: 0, background: 'var(--bg2)', padding: '16px', overflowY: 'auto', animation: 'up .15s ease', zIndex: 10 } : { width: '260px', borderLeft: '1px solid var(--bd)', background: 'var(--bg2)', padding: '20px', flexShrink: 0, overflowY: 'auto', animation: 'up .15s ease' }}>
            <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.12em', marginBottom: '18px' }}>// CONFIGURACOES</div>
            {[{ label: 'FOCO (min)', key: 'focusDuration', min: 1, max: 120 }, { label: 'PAUSA CURTA (min)', key: 'shortBreak', min: 1, max: 30 }, { label: 'PAUSA LONGA (min)', key: 'longBreak', min: 1, max: 60 }, { label: 'SESSOES p/ LONGA', key: 'longBreakInterval', min: 2, max: 10 }].map(({ label, key, min, max }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.1em', marginBottom: '6px' }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" min={min} max={max} value={localSettings[key]} onChange={e => setLocalSettings(s => ({ ...s, [key]: Math.max(min, Math.min(max, +e.target.value)) }))} style={{ background: 'var(--bg3)', border: '1px solid var(--bdb)', color: 'var(--g)', fontSize: '13px', padding: '4px 8px', outline: 'none', width: '70px', textAlign: 'center' }} />
                  <input type="range" min={min} max={max} value={localSettings[key]} onChange={e => setLocalSettings(s => ({ ...s, [key]: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--g)' }} />
                </div>
              </div>
            ))}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.1em', marginBottom: '6px' }}>FLASHCARDS NO POMODORO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[{ key: 'due', label: 'REVISAO REAL' }, { key: 'all', label: 'TREINO LIVRE' }].map(opt => (
                  <button key={opt.key} onClick={() => setLocalSettings(s => ({ ...s, flashcardMode: opt.key }))} style={{ background: localSettings.flashcardMode === opt.key ? 'var(--g)' : 'transparent', border: `1px solid ${localSettings.flashcardMode === opt.key ? 'var(--g)' : 'var(--bd)'}`, color: localSettings.flashcardMode === opt.key ? '#001807' : 'var(--mu)', fontSize: '10px', padding: '7px 6px', cursor: 'pointer', letterSpacing: '0.06em', fontWeight: 700 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--gm)', lineHeight: 1.5, marginTop: '7px' }}>
                {(localSettings.flashcardMode || 'due') === 'all' ? 'Mostra todos os cards do assunto; os botoes nao salvam revisao.' : 'Mostra apenas cards vencidos; os botoes atualizam revisao e agenda.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <TBtn onClick={saveSettings} sm>[ SALVAR ]</TBtn>
              <TBtn onClick={() => { setLocalSettings({ ...settings }); setShowSettings(false); }} color="muted" sm>[ CANCELAR ]</TBtn>
            </div>
            <div style={{ marginTop: '18px', fontSize: '10px', color: 'var(--gm)', lineHeight: 1.8, borderTop: '1px solid var(--bd)', paddingTop: '14px' }}>
              <div style={{ color: 'var(--mu)', letterSpacing: '0.1em', marginBottom: '6px' }}>PADRAO POMOFOCUS</div>
              <div>Foco: 25 min</div><div>Pausa curta: 5 min</div><div>Pausa longa: 15 min</div><div>A cada 4 sessoes</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function HomeScreen({ data, onNavigate }) {
  const mobile = useMobile();
  const [time, setTime] = React.useState(new Date());
  const alreadyBooted = !!localStorage.getItem(BOOT_KEY);
  const [showBoot, setShowBoot] = React.useState(!alreadyBooted);
  const [lines, setLines] = React.useState(0);
  React.useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);

  const pomToday = data.pomodoroHistory.filter(h => h.date === today()).reduce((a, h) => a + h.count, 0);
  const thisWeek = weekKey();
  const thisYear = new Date().getFullYear().toString();
  const focusDay = data.pomodoroHistory.filter(h => h.date === today()).reduce((a, h) => a + h.minutes, 0);
  const focusWeek = data.pomodoroHistory.filter(h => h.date >= thisWeek).reduce((a, h) => a + h.minutes, 0);
  const focusYear = data.pomodoroHistory.filter(h => h.date.startsWith(thisYear)).reduce((a, h) => a + h.minutes, 0);
  const dueNow = data.cards.filter(isDue).length;

  const bootMsgs = [
    '> Inicializando FlashCards Terminal v3.0...',
    '> Carregando algoritmo SM-2...',
    `> ${data.cards.length} card(s) em ${data.subjects.length} assunto(s)`,
    `> ${dueNow} card(s) para revisar hoje`,
    `> Streak ativo: ${data.streak.count} dia(s)`,
    '> Sistema pronto. Bons estudos.',
  ];

  React.useEffect(() => {
    if (!showBoot) return;
    let i = 0;
    const tick = () => { i++; setLines(i); if (i >= bootMsgs.length) { setTimeout(() => { localStorage.setItem(BOOT_KEY, '1'); setShowBoot(false); }, 350); } else setTimeout(tick, 180); };
    setTimeout(tick, 80);
  }, []);

  if (showBoot) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: mobile ? '32px 24px' : '60px 80px', gap: '5px' }}>
      {bootMsgs.slice(0, lines).map((line, i) => (
        <div key={i} style={{ fontSize: '13px', color: i === lines - 1 ? 'var(--g)' : 'var(--mu)', animation: 'bootL .18s ease', overflow: 'hidden' }}>
          {line}{i === lines - 1 && <span style={{ animation: 'blink 1s step-end infinite', marginLeft: '2px' }}>_</span>}
        </div>
      ))}
    </div>
  );

  const h = time.getHours();
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const hh = String(h).padStart(2, '0'), mm = String(time.getMinutes()).padStart(2, '0'), ss = String(time.getSeconds()).padStart(2, '0');
  const dateStr = time.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const totalAns = data.cards.reduce((a, c) => a + c.correct + c.wrong + (c.hard || 0) + (c.easy || 0), 0),
    totalCor = data.cards.reduce((a, c) => a + c.correct + (c.easy || 0), 0);
  const gPct = totalAns === 0 ? null : Math.round(totalCor / totalAns * 100);

  const subjStats = data.subjects.map(s => {
    const sc = data.cards.filter(c => c.subject === s);
    const ans = sc.reduce((a, c) => a + c.correct + c.wrong + (c.hard || 0) + (c.easy || 0), 0),
      cor = sc.reduce((a, c) => a + c.correct + (c.easy || 0), 0);
    const pomS = data.pomodoroHistory.filter(h => h.subject === s).reduce((a, h) => a + h.count, 0);
    return { name: s, count: sc.length, pct: ans === 0 ? null : Math.round(cor / ans * 100), due: sc.filter(isDue).length, ans, pomo: pomS };
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', animation: 'up .2s ease' }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'flex-start' : 'center', justifyContent: 'space-between', padding: mobile ? '14px 16px 12px' : '26px 44px 22px', borderBottom: '1px solid var(--bd)', flexShrink: 0, gap: mobile ? '12px' : 0 }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.14em', marginBottom: '5px' }}>{dateStr.toUpperCase()}</div>
          <div style={{ fontSize: mobile ? '44px' : '62px', fontWeight: 700, lineHeight: 1, animation: 'cpulse 2s ease-in-out infinite', color: 'var(--g)', letterSpacing: '0.03em' }}>
            {hh}<span style={{ opacity: time.getSeconds() % 2 === 0 ? 1 : 0.2, transition: 'opacity .1s' }}>:</span>{mm}
            <span style={{ fontSize: '28px', opacity: 0.4, marginLeft: '5px' }}>{ss}</span>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--gd)', marginTop: '6px', fontWeight: 300 }}>{greeting} - {dueNow > 0 ? `${dueNow} card${dueNow > 1 ? 's' : ''} para revisar` : 'tudo em dia!'}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: mobile ? 'flex-start' : 'flex-end' }}>
          {[
            { label: 'CARDS', val: data.cards.length, c: 'var(--g)' },
            { label: 'PENDENTES', val: dueNow, c: dueNow > 0 ? 'var(--yel)' : 'var(--cyn)' },
            { label: 'STREAK', val: `${data.streak.count}d`, c: 'var(--yel)' },
            { label: 'ACERTOS', val: gPct !== null ? `${gPct}%` : '-', c: gPct === null ? 'var(--mu)' : gPct >= 80 ? 'var(--cyn)' : gPct >= 50 ? 'var(--g)' : 'var(--yel)' },
            { label: 'FOCO DIA', val: formatHours(focusDay), c: 'var(--oran)' },
            { label: 'FOCO SEM', val: formatHours(focusWeek), c: 'var(--oran)' },
            { label: 'FOCO ANO', val: formatHours(focusYear), c: 'var(--oran)' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid var(--bd)', background: 'var(--bg2)', padding: mobile ? '8px 10px' : '12px 16px', textAlign: 'center', minWidth: mobile ? '60px' : '78px' }}>
              <div style={{ fontSize: mobile ? '18px' : '24px', fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: '9px', color: 'var(--mu)', letterSpacing: '0.12em', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: mobile ? '10px 16px' : '14px 44px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <TBtn onClick={() => onNavigate('study', null)} disabled={dueNow === 0}>[ REVISAR ({dueNow}) ]</TBtn>
        <TBtn onClick={() => onNavigate('pomodoro', null)} color="orange">[ POMODORO ]</TBtn>
        <TBtn onClick={() => onNavigate('study-all', null)} color="muted">[ ESTUDAR TODOS ]</TBtn>
        <TBtn onClick={() => onNavigate('addcard', null)} color="cyan">[ + CARD ]</TBtn>
        <TBtn onClick={() => onNavigate('import', null)} color="yellow">[ IMPORTAR ]</TBtn>
        <TBtn onClick={() => onNavigate('dashboard', null)} color="muted">[ VER CARDS ]</TBtn>
      </div>
      <div style={{ flex: 1, padding: mobile ? '14px 16px' : '20px 44px', display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 520px', gap: '18px', alignItems: 'start', overflowY: 'auto' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.14em', marginBottom: '12px' }}>PROGRESSO POR ASSUNTO</div>
          {subjStats.length === 0 && <div style={{ fontSize: '13px', color: 'var(--mu)' }}>Nenhum assunto ainda.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {subjStats.map((s, i) => {
              const bc = s.pct === null ? 'var(--bdb)' : s.pct >= 80 ? 'var(--cyn)' : s.pct >= 50 ? 'var(--g)' : 'var(--yel)';
              return (
                <div key={s.name} onClick={() => onNavigate('study', s.name)} style={{ border: '1px solid var(--bd)', background: 'var(--bg2)', padding: '12px 15px', cursor: 'pointer', transition: 'border-color .12s,background .12s', animation: `up ${0.3 + i * 0.07}s ease` }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gm)'; e.currentTarget.style.background = 'var(--bg3)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.background = 'var(--bg2)'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--wh)', fontWeight: 500 }}>{s.name}</span>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', alignItems: 'center' }}>
                      {s.pomo > 0 && <span style={{ color: 'var(--oran)', fontSize: '10px', border: '1px solid var(--oran)', padding: '0 5px' }}>POMO {s.pomo}</span>}
                      {s.due > 0 && <span style={{ color: 'var(--yel)', fontSize: '10px' }}>DUE {s.due}</span>}
                      <span style={{ color: 'var(--mu)' }}>{s.count}</span>
                    </div>
                  </div>
                  <div style={{ height: '2px', background: 'var(--bg3)', marginBottom: '6px' }}><div style={{ height: '100%', width: s.pct !== null ? `${s.pct}%` : '0', background: bc, transition: 'width .5s' }} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: bc }}>{s.pct !== null ? `${s.pct}% acertos` : 'nao estudado'}</span>
                    <span style={{ color: 'var(--mu)', fontSize: '10px' }}>{s.ans > 0 ? `${s.ans} resp.` : '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <AnkiChart history={data.history} cards={data.cards} />
          <PomodoroChart pomodoroHistory={data.pomodoroHistory} subjects={data.subjects} />
          <div style={{ border: '1px solid var(--bd)', borderTop: 'none', background: 'var(--bg2)', padding: '12px 16px', fontSize: '11px', color: 'var(--mu)', lineHeight: 1.7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div><div style={{ fontSize: '9px', letterSpacing: '0.12em', marginBottom: '5px' }}>SM-2</div>
                <div><span style={{ color: 'var(--red)' }}>AGAIN</span> - volta para aprendizado</div><div><span style={{ color: 'var(--yel)' }}>HARD</span> - intervalo curto</div><div><span style={{ color: 'var(--g)' }}>GOOD</span> - agenda normal</div><div><span style={{ color: 'var(--cyn)' }}>EASY</span> - pula adiante</div>
              </div>
              <div><div style={{ fontSize: '9px', letterSpacing: '0.12em', marginBottom: '5px' }}>POMODORO</div>
                <div>Foco: {data.pomodoroSettings.focusDuration}min</div>
                <div>Curta: {data.pomodoroSettings.shortBreak}min</div>
                <div>Longa: {data.pomodoroSettings.longBreak}min</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function Dashboard({ cards, subjects, activeSubject, onStudy, onStudyAll, onAddCard, onEditCard, onImport, onDeleteCard, onDeleteSubject }) {
  const filtered = activeSubject ? cards.filter(c => c.subject === activeSubject) : [...cards];
  const tot = filtered.reduce((a, c) => a + c.correct + c.wrong + (c.hard || 0) + (c.easy || 0), 0),
    cor = filtered.reduce((a, c) => a + c.correct + (c.easy || 0), 0);
  const pct = tot === 0 ? null : Math.round(cor / tot * 100);
  const due = filtered.filter(isDue).length;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'up .18s ease' }}>
      <div style={{ padding: '11px 22px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: 'var(--bg2)', flexShrink: 0 }}>
        <span style={{ color: 'var(--mu)', fontSize: '12px', marginRight: '4px' }}>user@fc:~/{activeSubject || 'todos'}$</span>
        <TBtn onClick={onStudy} disabled={due === 0}>[ REVISAR ({due}) ]</TBtn>
        <TBtn onClick={onStudyAll} color="muted">[ TODOS ]</TBtn>
        <TBtn onClick={onAddCard} color="cyan">[ + CARD ]</TBtn>
        <TBtn onClick={onImport} color="yellow">[ IMPORTAR ]</TBtn>
        {activeSubject && <TBtn onClick={() => onDeleteSubject(activeSubject)} color="red">[ DEL ASSUNTO ]</TBtn>}
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--mu)' }}>
          {filtered.length} cards{pct !== null && <span style={{ marginLeft: '10px', color: pct >= 80 ? 'var(--cyn)' : pct >= 50 ? 'var(--g)' : 'var(--yel)' }}>OK  {pct}%</span>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: '13px', marginBottom: '20px' }}>Nenhum card aqui.</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}><TBtn onClick={onAddCard} color="cyan">[ + ADICIONAR ]</TBtn><TBtn onClick={onImport} color="yellow">[ IMPORTAR ]</TBtn></div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap: '10px' }}>
            {filtered.map((card, _ci) => {
              const t = card.correct + card.wrong + (card.hard || 0) + (card.easy || 0), p = t === 0 ? null : Math.round((card.correct + (card.easy || 0)) / t * 100);
              const cardDue = isDue(card);
              return (
                <div key={card.id || `c${_ci}`} style={{ border: `1px solid ${cardDue ? 'var(--bdb)' : 'var(--bd)'}`, background: 'var(--bg2)', padding: '12px 14px', position: 'relative', animation: 'up .15s ease' }}>
                  {cardDue && <div style={{ fontSize: '9px', color: 'var(--yel)', letterSpacing: '0.1em', marginBottom: '5px' }}>VENCE AGORA</div>}
                  <div style={{ fontSize: '12px', color: 'var(--wh)', marginBottom: '8px', lineHeight: 1.5 }}><CardContent text={card.front} image={card.frontImage} color="var(--wh)" fontSize="12px" /></div>
                  <div style={{ fontSize: '11px', color: 'var(--mu)', lineHeight: 1.5, marginBottom: '8px' }}><CardContent text={card.back} image={card.backImage} color="var(--mu)" fontSize="11px" /></div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: 'var(--gd)' }}>OK {card.correct}</span>
                      <span style={{ color: 'var(--red)' }}>NO {card.wrong}</span>
                      {p !== null && <span style={{ color: p >= 80 ? 'var(--cyn)' : 'var(--yel)' }}>{p}%</span>}
                      <span style={{ color: 'var(--mu)', fontSize: '10px' }}>next {dueLabel(card)}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--gm)', background: 'var(--bg3)', padding: '1px 6px', border: '1px solid var(--bd)' }}>{card.subject}</span>
                  </div>
                  <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                    <button onClick={() => onEditCard(card.id)} title="Editar card" style={{ background: 'transparent', border: 'none', color: 'var(--gm)', fontSize: '12px', cursor: 'pointer', padding: '2px 5px' }} onMouseEnter={e => e.target.style.color = 'var(--cyn)'} onMouseLeave={e => e.target.style.color = 'var(--gm)'}>EDIT</button>
                    <button onClick={() => onDeleteCard(card.id)} title="Deletar card" style={{ background: 'transparent', border: 'none', color: 'var(--gm)', fontSize: '12px', cursor: 'pointer', padding: '2px 5px' }} onMouseEnter={e => e.target.style.color = 'var(--red)'} onMouseLeave={e => e.target.style.color = 'var(--gm)'}>X</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function StudyMode({ cards, subject, dueOnly, onDone, onResult }) {
  const mobile = useMobile();
  const queue = React.useMemo(() => { let pool = subject ? cards.filter(c => c.subject === subject) : [...cards]; if (dueOnly) pool = pool.filter(isDue); return pool.sort(() => Math.random() - .5); }, []);
  const [idx, setIdx] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [res, setRes] = React.useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [done, setDone] = React.useState(false);

  if (queue.length === 0) return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}><div style={{ fontSize: '16px', color: 'var(--mu)' }}>Nenhum card para revisar.</div><TBtn onClick={onDone}>[ VOLTAR ]</TBtn></div>;

  const card = queue[idx];
  const cardIntervals = nextIntervals(card);
  const answer = grade => {
    onResult(card.id, grade);
    const r = { ...res }; r[grade]++;
    setRes(r); if (idx + 1 >= queue.length) { setDone(true); return; } setIdx(i => i + 1); setFlipped(false);
  };

  if (done) {
    const total = res.again + res.hard + res.good + res.easy, pct = Math.round((res.good + res.easy) / total * 100);
    return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', animation: 'up .2s ease' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '56px', fontWeight: 700, color: pct >= 80 ? 'var(--cyn)' : pct >= 50 ? 'var(--g)' : 'var(--yel)' }}>{pct}%</div>
        <div className="glow" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Sessao concluida</div>
        <div style={{ color: 'var(--mu)', fontSize: '13px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <span style={{ color: 'var(--red)' }}>AGAIN {res.again}</span><span style={{ color: 'var(--yel)' }}>HARD {res.hard}</span><span style={{ color: 'var(--g)' }}>GOOD {res.good}</span><span style={{ color: 'var(--cyn)' }}>EASY {res.easy}</span><span>/ {total}</span>
        </div>
      </div>
      <TBtn onClick={onDone}>[ VOLTAR ]</TBtn>
    </div>;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: '3px', background: 'var(--bg3)', flexShrink: 0 }}><div style={{ height: '100%', width: `${Math.round(idx / queue.length * 100)}%`, background: 'var(--g)', transition: 'width .3s' }} /></div>
      <div style={{ padding: '11px 22px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg2)', flexShrink: 0, flexWrap: 'wrap' }}>
        <TBtn onClick={onDone} color="muted" sm>[ SAIR ]</TBtn>
        <span style={{ color: 'var(--mu)', fontSize: '12px' }}>{idx + 1}/{queue.length} - {subject || 'todos'}</span>
        {!mobile && <span style={{ color: 'var(--mu)', fontSize: '10px' }}>estado: {(card.state || 'new').toUpperCase()} - prox: {dueLabel(card)} - ease {(card.ease || 2.5).toFixed(2)}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', fontSize: '12px' }}>
          <span style={{ color: 'var(--red)' }}>A{res.again}</span><span style={{ color: 'var(--yel)' }}>H{res.hard}</span><span style={{ color: 'var(--g)' }}>G{res.good}</span><span style={{ color: 'var(--cyn)' }}>E{res.easy}</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: mobile ? '14px 12px' : '32px' }}>
        <div style={{ width: '100%', maxWidth: '660px' }}>
          <div style={{ fontSize: '10px', color: 'var(--mu)', marginBottom: '12px', letterSpacing: '0.1em' }}>{card.subject} - {flipped ? 'RESPOSTA' : 'PERGUNTA'}</div>
          <div onClick={() => !flipped && setFlipped(true)} style={{ border: `1px solid ${flipped ? 'var(--gm)' : 'var(--bdb)'}`, background: flipped ? 'var(--gf)' : 'var(--bg2)', padding: '34px', minHeight: '170px', cursor: flipped ? 'default' : 'pointer', transition: 'all .2s', animation: 'up .15s ease', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
            {!flipped && <div style={{ position: 'absolute', bottom: '10px', right: '13px', fontSize: '11px', color: 'var(--mu)' }}>[ clique para revelar ]</div>}
            {flipped ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
                <div style={{ borderBottom: '1px solid var(--bd)', paddingBottom: '18px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.1em', marginBottom: '10px' }}>PERGUNTA</div>
                  <CardContent text={card.front} image={card.frontImage} color="var(--g)" fontSize="15px" />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.1em', marginBottom: '10px' }}>RESPOSTA</div>
                  <CardContent text={card.back} image={card.backImage} large color="var(--wh)" />
                </div>
              </div>
            ) : <CardContent text={card.front} image={card.frontImage} large color="var(--g)" />}
          </div>
          <div style={{ marginTop: '18px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {flipped ? <>
              <TBtn onClick={() => answer('again')} color="red">[ AGAIN {cardIntervals.again} ]</TBtn>
              <TBtn onClick={() => answer('hard')} color="yellow">[ HARD {cardIntervals.hard} ]</TBtn>
              <TBtn onClick={() => answer('good')} color="green">[ GOOD {cardIntervals.good} ]</TBtn>
              <TBtn onClick={() => answer('easy')} color="cyan">[ EASY {cardIntervals.easy} ]</TBtn>
            </> : <TBtn onClick={() => setFlipped(true)} color="cyan">[ REVELAR RESPOSTA ]</TBtn>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function AddCard({ subjects, defaultSubject, editingCard, onSave, onCancel }) {
  const mobile = useMobile();
  const [front, setFront] = React.useState(editingCard?.front || '');
  const [back, setBack] = React.useState(editingCard?.back || '');
  const [frontImage, setFrontImage] = React.useState(editingCard?.frontImage || null);
  const [backImage, setBackImage] = React.useState(editingCard?.backImage || null);
  const [pasteStatus, setPasteStatus] = React.useState('');
  const subjectOptions = subjects.includes(editingCard?.subject) ? subjects : (editingCard?.subject ? [editingCard.subject, ...subjects] : subjects);
  const [subject, setSubject] = React.useState(editingCard?.subject || defaultSubject || subjects[0] || '');
  const canSave = subject && (front.trim() || frontImage) && (back.trim() || backImage);
  const pasteImageTo = setter => async e => {
    const items = [...(e.clipboardData?.items || [])];
    const item = items.find(i => i.type && i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    setPasteStatus('colando imagem...');
    try {
      const file = item.getAsFile();
      setter(await uploadMedia(file));
      setPasteStatus('imagem colada e comprimida');
      setTimeout(() => setPasteStatus(''), 2500);
    } catch (ex) {
      setPasteStatus(ex.message || String(ex));
    }
  };
  const save = () => {
    if (!canSave) return;
    const base = editingCard || { id: uid(), correct: 0, wrong: 0, hard: 0, easy: 0, interval: 0, reps: 0, ease: 2.5, due: null, dueAt: null, state: 'new', stepIndex: 0, lapses: 0 };
    onSave({ ...base, subject, front: front.trim(), back: back.trim(), frontImage, backImage, updatedAt: nowISO() });
    if (!editingCard) { setFront(''); setBack(''); setFrontImage(null); setBackImage(null); }
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '11px 22px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg2)', flexShrink: 0 }}>
        <TBtn onClick={onCancel} color="muted" sm>[ VOLTAR ]</TBtn>
        <span style={{ color: 'var(--mu)', fontSize: '12px' }}>user@fc:~/{editingCard ? 'editar-card' : 'novo-card'}$</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '16px' : '28px 36px', maxWidth: '620px' }}>
        <div style={{ fontSize: '10px', color: 'var(--mu)', marginBottom: '20px', letterSpacing: '0.1em' }}>{editingCard ? '// EDITAR FLASHCARD' : '// NOVO FLASHCARD'}</div>
        <Field label="ASSUNTO"><TSelect value={subject} onChange={setSubject} options={subjectOptions} /></Field>
        <Field label="FRENTE (PERGUNTA)"><TArea value={front} onChange={setFront} onPaste={pasteImageTo(setFrontImage)} placeholder="Digite a pergunta... Ctrl+V cola imagem aqui" rows={3} /></Field>
        <Field label="IMAGEM DA FRENTE"><MediaPicker label="ADICIONAR FOTO" value={frontImage} onChange={setFrontImage} /></Field>
        <Field label="VERSO (RESPOSTA)"><TArea value={back} onChange={setBack} onPaste={pasteImageTo(setBackImage)} placeholder="Digite a resposta... Ctrl+V cola imagem aqui" rows={4} /></Field>
        <Field label="IMAGEM DO VERSO"><MediaPicker label="ADICIONAR FOTO" value={backImage} onChange={setBackImage} /></Field>
        {pasteStatus && <div style={{ fontSize: '10px', color: pasteStatus.includes('comprimida') ? 'var(--cyn)' : 'var(--yel)', lineHeight: 1.5, marginTop: '-8px', marginBottom: '14px' }}>{pasteStatus}</div>}
        <div style={{ display: 'flex', gap: '10px' }}><TBtn onClick={save} disabled={!canSave}>{editingCard ? '[ SALVAR EDICAO ]' : '[ SALVAR CARD ]'}</TBtn><TBtn onClick={onCancel} color="muted">[ CANCELAR ]</TBtn></div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function ImportView({ subjects, onImport, onCancel }) {
  const mobile = useMobile();
  const [raw, setRaw] = React.useState('');
  const [subject, setSubject] = React.useState(subjects[0] || '');
  const [preview, setPreview] = React.useState([]);
  const [log, setLog] = React.useState('');
  const parse = () => {
    const lines = raw.trim().split('\n').filter(l => l.trim()), parsed = [];
    for (const line of lines) { const sep = line.includes(';') ? ';' : line.includes('\t') ? '\t' : '|'; const parts = line.split(sep); if (parts.length >= 2) parsed.push({ front: parts[0].trim(), back: parts[1].trim() }); }
    setPreview(parsed); setLog(parsed.length > 0 ? `OK  ${parsed.length} card(s) detectado(s)` : 'NO  Nenhum card valido encontrado');
  };
  const doImport = () => {
    if (!preview.length || !subject) return;
    onImport(preview.map(p => ({ id: uid(), subject, front: p.front, back: p.back, correct: 0, wrong: 0, hard: 0, easy: 0, interval: 0, reps: 0, ease: 2.5, due: null, dueAt: null, state: 'new', stepIndex: 0, lapses: 0, updatedAt: nowISO() })));
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '11px 22px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg2)', flexShrink: 0 }}>
        <TBtn onClick={onCancel} color="muted" sm>[ VOLTAR ]</TBtn>
        <span style={{ color: 'var(--mu)', fontSize: '12px' }}>user@fc:~/importar$</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '16px' : '28px 36px', maxWidth: '780px' }}>
        <div style={{ fontSize: '10px', color: 'var(--mu)', marginBottom: '4px', letterSpacing: '0.1em' }}>// IMPORTAR CARDS</div>
        <div style={{ fontSize: '11px', color: 'var(--gm)', marginBottom: '20px' }}>Formato: FRENTE ; VERSO - aceita ; | tab</div>
        <Field label="ASSUNTO"><TSelect value={subject} onChange={setSubject} options={subjects} /></Field>
        <Field label="COLE O TEXTO / CSV"><TArea value={raw} onChange={setRaw} placeholder={"O que e substancia? ; Essencia imutavel (Spinoza)\nDerivada de sen(x) ; cos(x)"} rows={7} /></Field>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
          <TBtn onClick={parse} color="yellow">[ ANALISAR ]</TBtn>
          {log && <span style={{ fontSize: '12px', color: log.startsWith('OK ') ? 'var(--g)' : 'var(--red)' }}>{log}</span>}
        </div>
        {preview.length > 0 && <div style={{ marginBottom: '16px', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--bd)', background: 'var(--bg3)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {preview.map((p, i) => <div key={i} style={{ fontSize: '11px', display: 'flex', gap: '8px' }}><span style={{ color: 'var(--mu)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}.</span><span style={{ color: 'var(--wh)' }}>{p.front}</span><span style={{ color: 'var(--mu)' }}>-&gt;</span><span style={{ color: 'var(--gd)' }}>{p.back}</span></div>)}
        </div>}
        <div style={{ display: 'flex', gap: '10px' }}><TBtn onClick={doImport} disabled={!preview.length}>[ IMPORTAR {preview.length || ''} CARDS ]</TBtn><TBtn onClick={onCancel} color="muted">[ CANCELAR ]</TBtn></div>
      </div>
    </div>
  );
}
