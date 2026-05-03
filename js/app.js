// ------------------------------------------------------------
// uploadMedia — comprime imagem client-side e retorna base64
// ------------------------------------------------------------
async function uploadMedia(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const dataUrl = await fileToDataUrl(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      const scale = Math.min(MAX / img.width, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.src = dataUrl;
  });
}

// Barra de navegação inferior para mobile
function BottomNav({ mode, onHome, onFlashcards, onPomodoro, onAddCard, onAddSubject }) {
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const navItems = [
    { label: 'HOME', m: 'home', fn: onHome, col: 'var(--g)' },
    { label: 'CARDS', m: 'dashboard', fn: onFlashcards, col: 'var(--cyn)' },
    { label: 'POMO', m: 'pomodoro', fn: onPomodoro, col: 'var(--oran)' },
  ];
  const btnStyle = (active, col) => ({ flex: 1, background: active ? 'var(--gf)' : 'transparent', border: 'none', borderTop: `2px solid ${active ? col : 'transparent'}`, color: active ? col : 'var(--mu)', fontSize: '10px', letterSpacing: '0.08em', cursor: 'pointer', transition: 'all .1s', padding: '6px 2px', fontFamily: 'inherit' });
  return (
    <>
      {showAddMenu && (
        <div onClick={() => setShowAddMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 198 }} />
      )}
      {showAddMenu && (
        <div style={{ position: 'fixed', bottom: '60px', right: '12px', zIndex: 201, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', animation: 'up .12s ease' }}>
          <button onClick={() => { setShowAddMenu(false); onAddSubject(); }} style={{ background: 'var(--bg2)', border: '1px solid var(--gm)', color: 'var(--g)', fontSize: '12px', padding: '11px 20px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
            + ASSUNTO
          </button>
          <button onClick={() => { setShowAddMenu(false); onAddCard(); }} style={{ background: 'var(--bg2)', border: '1px solid var(--cyn)', color: 'var(--cyn)', fontSize: '12px', padding: '11px 20px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
            + CARD
          </button>
        </div>
      )}
      <div className="bnav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '52px', background: 'var(--bg2)', borderTop: '1px solid var(--bd)', display: 'flex', alignItems: 'stretch', zIndex: 200 }}>
        {navItems.map(({ label, m, fn, col }) => (
          <button key={m} onClick={fn} style={btnStyle(mode === m, col)}>{label}</button>
        ))}
        <button onClick={() => setShowAddMenu(s => !s)} style={btnStyle(showAddMenu, 'var(--cyn)')}>
          <span style={{ fontSize: '18px', lineHeight: 1, fontWeight: 300 }}>{showAddMenu ? '×' : '+'}</span>
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------
// Componente raiz
// ------------------------------------------------------------
function App() {
  const fileSupported = !!(window.showOpenFilePicker && window.showSaveFilePicker);
  const mobile = useMobile();
  const [data, setData] = React.useState(null);
  const [view, setView] = React.useState('home');
  const [studySubject, setStudySubject] = React.useState(null);
  const [studyDueOnly, setStudyDueOnly] = React.useState(true);
  const [fileHandle, setFileHandle] = React.useState(null);
  const [fileLabel, setFileLabel] = React.useState('');
  const [storageStatus, setStorageStatus] = React.useState('LOCAL');
  const [editingCardId, setEditingCardId] = React.useState(null);
  const saveChainRef = React.useRef(Promise.resolve());
  const fileRestoreAttempted = React.useRef(false);

  // Carrega dados do IndexedDB na montagem
  React.useEffect(() => {
    (async () => {
      try {
        const persisted = await loadStateFromDB();
        if (persisted) {
          setData(markToday(normalizeData(persisted)));
        } else {
          setData(DEF);
        }
      } catch {
        setData(DEF);
      }
    })();
  }, []);

  // Salva no IndexedDB (e no arquivo JSON conectado) sempre que data muda
  React.useEffect(() => {
    if (!data) return;
    const persisted = stampData(data);
    setStorageStatus('SALVANDO');
    saveChainRef.current = saveChainRef.current
      .then(() => saveStateToDB(persisted))
      .then(() => { if (fileHandle) return writeDataFile(fileHandle, persisted); })
      .then(() => setStorageStatus('SALVO'))
      .catch(() => setStorageStatus('ERRO'));
  }, [data, fileHandle]);

  // Tenta restaurar handle do arquivo JSON lembrado (roda 1x após data carregar)
  React.useEffect(() => {
    if (!fileSupported || !data || fileRestoreAttempted.current) return;
    fileRestoreAttempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const handle = await loadRememberedDataFile();
        if (!handle || cancelled) return;
        if (!(await hasFilePermission(handle))) return;
        const fileData = markToday(await readDataFile(handle));
        const nextData = newerData(data, fileData);
        if (cancelled) return;
        await writeDataFile(handle, nextData);
        setData(nextData);
        setFileHandle(handle);
        setFileLabel(handle.name || 'flashcards-data.json');
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [fileSupported, data]);

  // ---------- handlers de estado ----------
  const navigate = (screen, subject = null) => {
    if (screen === 'study' || screen === 'study-all') {
      setStudySubject(subject);
      setStudyDueOnly(screen === 'study');
      setView('study');
    } else if (screen === 'pomodoro') {
      setStudySubject(subject);
      setView('pomodoro');
    } else if (screen === 'dashboard') {
      setStudySubject(subject);
      setView('dashboard');
    } else if (screen === 'addcard') {
      setView('addcard');
    } else if (screen === 'import') {
      setView('import');
    } else {
      setView('home');
    }
    setEditingCardId(null);
  };

  const addSubject = name => {
    if (!name || data.subjects.includes(name)) return;
    setData(d => ({ ...d, subjects: [...d.subjects, name] }));
  };

  const deleteSubject = name => {
    if (!confirm(`Deletar o assunto "${name}" e todos os seus cards?`)) return;
    setData(d => ({ ...d, subjects: d.subjects.filter(s => s !== name), cards: d.cards.filter(c => c.subject !== name) }));
    setView('home');
  };

  const deleteCard = id => {
    if (!confirm('Deletar este card?')) return;
    setData(d => ({ ...d, cards: d.cards.filter(c => c.id !== id) }));
  };

  const addCard = card => {
    setData(d => {
      const subs = d.subjects.includes(card.subject) ? d.subjects : [...d.subjects, card.subject];
      const cards = d.cards.find(c => c.id === card.id) ? d.cards.map(c => c.id === card.id ? card : c) : [...d.cards, card];
      return { ...d, subjects: subs, cards };
    });
    setEditingCardId(null);
  };

  const updateCard = card => addCard(card);

  const startEditCard = id => {
    setEditingCardId(id);
    setView('addcard');
  };

  const importCards = newCards => {
    setData(d => {
      const subs = [...new Set([...d.subjects, ...newCards.map(c => c.subject)])];
      return { ...d, subjects: subs, cards: [...d.cards, ...newCards] };
    });
    setView('dashboard');
  };

  const recordResult = (cardId, grade) => {
    setData(d => ({
      ...d,
      cards: d.cards.map(c => {
        if (c.id !== cardId) return c;
        const scheduled = scheduleCard(c, grade);
        const counter = grade === 'again' ? 'wrong' : grade === 'hard' ? 'hard' : grade === 'easy' ? 'easy' : 'correct';
        return { ...c, ...scheduled, [counter]: (c[counter] || 0) + 1 };
      }),
      history: (() => {
        const todayKey = today();
        const rec = d.history.find(h => h.date === todayKey);
        const field = grade === 'again' ? 'wrong' : 'correct';
        if (rec) return d.history.map(h => h.date === todayKey ? { ...h, [field]: (h[field] || 0) + 1, total: (h.total || 0) + 1 } : h);
        return [...d.history, { date: todayKey, correct: grade !== 'again' ? 1 : 0, wrong: grade === 'again' ? 1 : 0, total: 1 }];
      })(),
      streak: markStreak(d.streak)
    }));
  };

  const markStreak = streak => {
    const t = today();
    if (streak.lastDate === t) return streak;
    const yesterday = addDays(-1);
    if (streak.lastDate === yesterday) return { count: streak.count + 1, lastDate: t };
    return { count: 1, lastDate: t };
  };

  const recordPomodoro = (subject, count, minutes) => {
    setData(d => {
      const todayKey = today();
      const existing = d.pomodoroHistory.find(h => h.date === todayKey && h.subject === subject);
      if (existing) return { ...d, pomodoroHistory: d.pomodoroHistory.map(h => (h.date === todayKey && h.subject === subject) ? { ...h, count: h.count + count, minutes: (h.minutes || 0) + minutes } : h) };
      return { ...d, pomodoroHistory: [...d.pomodoroHistory, { date: todayKey, subject, count, minutes }] };
    });
  };

  const savePomodoroSettings = newSettings => {
    setData(d => ({ ...d, pomodoroSettings: { ...d.pomodoroSettings, ...newSettings } }));
  };

  const exportData = () => {
    const persisted = stampData(data);
    const blob = new Blob([JSON.stringify(persisted, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const parsed = JSON.parse(ev.target.result);
          validateData(parsed);
          setData(normalizeData(parsed));
        } catch {
          alert('Arquivo invalido ou corrompido.');
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const connectDataFile = async () => {
    if (!fileSupported) return;
    try {
      const [handle] = await window.showOpenFilePicker({ types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
      let fileData;
      try {
        fileData = markToday(await readDataFile(handle));
      } catch {
        fileData = null;
      }
      const useExisting = fileData && (fileData.cards?.length > 0 || fileData.subjects?.length > 0);
      const nextData = useExisting ? newerData(data, fileData) : data;
      if (useExisting) await writeDataFile(handle, nextData);
      await rememberDataFile(handle);
      setData(nextData);
      setFileHandle(handle);
      setFileLabel(handle.name);
    } catch {}
  };

  // Tela de carregamento inicial
  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '16px', color: 'var(--g)', animation: 'cpulse 1.5s ease-in-out infinite' }}>CARREGANDO...</div>
        <div style={{ fontSize: '11px', color: 'var(--mu)' }}>Abrindo IndexedDB</div>
      </div>
    );
  }

  const todayPomodoroCount = data.pomodoroHistory.filter(h => h.date === today()).reduce((a, h) => a + h.count, 0);
  const editingCard = editingCardId ? data.cards.find(c => c.id === editingCardId) : null;

  const sidebar = (
    <Sidebar
      subjects={data.subjects}
      activeSubject={studySubject}
      onSelect={s => { setStudySubject(s); setView('dashboard'); }}
      onAdd={addSubject}
      cards={data.cards}
    />
  );

  let content;
  if (view === 'pomodoro') {
    content = (
      <PomodoroMode
        subjects={data.subjects.length ? data.subjects : ['Geral']}
        cards={data.cards}
        settings={data.pomodoroSettings}
        todaySessionCount={todayPomodoroCount}
        onDone={() => navigate('home')}
        onComplete={(subject, count, minutes) => recordPomodoro(subject, count, minutes)}
        onSaveSettings={savePomodoroSettings}
        onCardResult={recordResult}
      />
    );
  } else if (view === 'study') {
    content = (
      <StudyMode
        cards={data.cards}
        subject={studySubject}
        dueOnly={studyDueOnly}
        onDone={() => navigate(studySubject ? 'dashboard' : 'home', studySubject)}
        onResult={recordResult}
      />
    );
  } else if (view === 'dashboard') {
    content = (
      <Dashboard
        cards={data.cards}
        subjects={data.subjects}
        activeSubject={studySubject}
        onStudy={() => navigate('study', studySubject)}
        onStudyAll={() => navigate('study-all', studySubject)}
        onAddCard={() => navigate('addcard')}
        onEditCard={startEditCard}
        onImport={() => navigate('import')}
        onDeleteCard={deleteCard}
        onDeleteSubject={deleteSubject}
      />
    );
  } else if (view === 'addcard') {
    content = (
      <AddCard
        subjects={data.subjects}
        defaultSubject={studySubject || data.subjects[0] || ''}
        editingCard={editingCard}
        onSave={addCard}
        onCancel={() => navigate(editingCard ? 'dashboard' : 'home', studySubject)}
      />
    );
  } else if (view === 'import') {
    content = (
      <ImportView
        subjects={data.subjects}
        onImport={importCards}
        onCancel={() => navigate('home')}
      />
    );
  } else {
    content = (
      <HomeScreen
        data={data}
        onNavigate={navigate}
      />
    );
  }

  const showSidebar = !['pomodoro', 'study'].includes(view);
  const showBottomNav = mobile && view !== 'study';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header
        data={data}
        mode={view}
        storageStatus={storageStatus}
        fileLabel={fileLabel}
        fileSupported={fileSupported}
        onHome={() => navigate('home')}
        onPomodoro={() => navigate('pomodoro')}
        onFlashcards={() => { setStudySubject(null); navigate('dashboard'); }}
        onExport={exportData}
        onImport={importData}
        onConnectFile={fileHandle ? () => { setFileHandle(null); setFileLabel(''); } : connectDataFile}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', paddingBottom: showBottomNav ? '52px' : 0 }}>
        {showSidebar && !mobile && sidebar}
        {content}
      </div>
      {showBottomNav && (
        <BottomNav
          mode={view}
          onHome={() => navigate('home')}
          onFlashcards={() => { setStudySubject(null); navigate('dashboard'); }}
          onPomodoro={() => navigate('pomodoro')}
          onAddCard={() => navigate('addcard')}
          onAddSubject={() => { const name = prompt('Nome do novo assunto:'); if (name && name.trim()) addSubject(name.trim()); }}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
