// ------------------------------------------------------------
// Componentes visuais reutilizáveis
// uploadMedia é definida em app.js — disponível no escopo global quando chamada
// ------------------------------------------------------------
const COLS = { green: { b: '#00ff41', t: '#00ff41', h: '#00ff4118' }, red: { b: '#ff4444', t: '#ff4444', h: '#ff444418' }, yellow: { b: '#ffd700', t: '#ffd700', h: '#ffd70018' }, cyan: { b: '#00ffcc', t: '#00ffcc', h: '#00ffcc18' }, orange: { b: '#ff8c00', t: '#ff8c00', h: '#ff8c0018' }, muted: { b: '#2a4a2a', t: '#4a7a4a', h: '#2a4a2a30' } };

function TBtn({ children, onClick, color = 'green', disabled = false, sm: small = false, full = false }) {
  const c = COLS[color] || COLS.green;
  return <button onClick={onClick} disabled={disabled} style={{ border: `1px solid ${disabled ? '#1a2e1a' : c.b}`, color: disabled ? '#1a2e1a' : c.t, background: 'transparent', padding: small ? '3px 10px' : '6px 16px', fontSize: small ? '11px' : '13px', letterSpacing: '0.05em', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', width: full ? '100%' : 'auto', transition: 'background .1s' }} onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = c.h; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>{children}</button>;
}

function TInput({ value, onChange, placeholder, onKeyDown, autoFocus }) {
  return <input autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--bdb)', color: 'var(--g)', fontSize: '13px', padding: '4px 0', outline: 'none', width: '100%', caretColor: 'var(--g)' }} />;
}

function TArea({ value, onChange, placeholder, rows = 4, onPaste }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} onPaste={onPaste} placeholder={placeholder} rows={rows} style={{ background: 'var(--bg3)', border: '1px solid var(--bd)', color: 'var(--g)', fontSize: '12px', padding: '10px', outline: 'none', width: '100%', resize: 'vertical', caretColor: 'var(--g)', lineHeight: 1.6 }} />;
}

function Field({ label, children }) {
  return <div style={{ marginBottom: '18px' }}><div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.12em', marginBottom: '7px' }}>{label}</div>{children}</div>;
}

function TSelect({ value, onChange, options }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--bdb)', color: 'var(--g)', fontSize: '12px', padding: '6px 10px', outline: 'none', cursor: 'pointer', width: '100%' }}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>;
}

function MediaPicker({ label, value, onChange }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const pick = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setErr('');
    try { onChange(await uploadMedia(file)); }
    catch (ex) { setErr(ex.message || String(ex)); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ border: '1px solid var(--bd)', color: 'var(--cyn)', background: 'transparent', padding: '4px 10px', fontSize: '11px', cursor: busy ? 'wait' : 'pointer', letterSpacing: '0.05em' }}>
          {busy ? '[ PROCESSANDO ]' : `[ ${label} ]`}
          <input type="file" accept="image/*" onChange={pick} disabled={busy} style={{ display: 'none' }} />
        </label>
        {value && <TBtn onClick={() => onChange(null)} color="muted" sm>[ REMOVER IMG ]</TBtn>}
        {value && <span style={{ fontSize: '10px', color: 'var(--gm)' }}>salva no IndexedDB</span>}
      </div>
      {value && <img src={value} style={{ maxWidth: '180px', maxHeight: '120px', objectFit: 'contain', border: '1px solid var(--bd)', background: '#020602', padding: '4px' }} />}
      {err && <div style={{ fontSize: '10px', color: 'var(--red)', lineHeight: 1.5 }}>{err}</div>}
    </div>
  );
}

function CardContent({ text, image, large = false, color = 'var(--g)', fontSize }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: image && text ? '14px' : '0', width: '100%', alignItems: 'stretch', color }}>
      {image && <img src={image} style={{ maxWidth: '100%', maxHeight: large ? '360px' : '170px', objectFit: 'contain', alignSelf: 'center', border: '1px solid var(--bd)', background: '#020602', padding: '6px' }} />}
      {text && <div style={{ fontSize: fontSize || (large ? '18px' : '15px'), lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</div>}
    </div>
  );
}

function TabBtn({ label, active, onClick, color = 'var(--g)' }) {
  return <button onClick={onClick} style={{ background: active ? 'var(--gf)' : 'transparent', border: `1px solid ${active ? color : 'var(--bd)'}`, color: active ? color : 'var(--mu)', fontSize: '10px', padding: '2px 8px', cursor: 'pointer', letterSpacing: '0.04em', transition: 'all .1s' }}>{label}</button>;
}

// ------------------------------------------------------------
function Header({ data, mode, onHome, onPomodoro, onFlashcards, onExport, onImport, onConnectFile, fileLabel, storageStatus, fileSupported }) {
  const [t, setT] = React.useState(new Date());
  React.useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const ts = t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const pomToday = data.pomodoroHistory.filter(h => h.date === today()).reduce((a, h) => a + h.count, 0);
  const navClick = (e, fn, hash) => { if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); history.replaceState(null, '', hash); fn(); };
  return (
    <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--bd)', padding: '0 20px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <a className="glow" href="#home" onClick={e => navClick(e, onHome, '#home')} style={{ textDecoration: 'none', color: 'var(--g)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', opacity: mode === 'home' ? 1 : 0.6, transition: 'opacity .15s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = mode === 'home' ? 1 : 0.6}>> FLASHCARDS.SH</a>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { label: 'HOME', m: 'home', fn: onHome },
            { label: 'FLASHCARDS', m: 'dashboard', fn: onFlashcards },
            { label: 'POMODORO', m: 'pomodoro', fn: onPomodoro, col: 'var(--oran)' },
          ].map(({ label, m, fn, col }) => (
            <a key={m} href={`#${m}`} onClick={e => navClick(e, fn, `#${m}`)} style={{ textDecoration: 'none', background: 'transparent', border: `1px solid ${mode === m ? (col || 'var(--g)') : 'var(--bd)'}`, color: mode === m ? (col || 'var(--g)') : 'var(--mu)', fontSize: '11px', padding: '2px 10px', cursor: 'pointer', letterSpacing: '0.05em', transition: 'all .12s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = col || 'var(--g)'; e.currentTarget.style.color = col || 'var(--g)'; }} onMouseLeave={e => { if (mode !== m) { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.color = 'var(--mu)'; } }}>{label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '12px' }}>
        {pomToday > 0 && <span style={{ color: 'var(--oran)', fontSize: '11px' }}>POMO: {pomToday} hoje</span>}
        <span style={{ color: 'var(--yel)' }}>STREAK {data.streak.count}d</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onConnectFile} title={fileSupported ? 'Conectar arquivo JSON de dados' : 'Salvamento gerenciado automaticamente'} style={{ background: 'transparent', border: '1px solid var(--bd)', color: fileLabel ? 'var(--g)' : 'var(--mu)', fontSize: '10px', padding: '2px 8px', cursor: fileSupported ? 'pointer' : 'default', letterSpacing: '0.05em', transition: 'all .12s' }} onMouseEnter={e => { if (fileSupported) { e.currentTarget.style.borderColor = 'var(--g)'; e.currentTarget.style.color = 'var(--g)'; } }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.color = fileLabel ? 'var(--g)' : 'var(--mu)'; }} disabled={!fileSupported}>{fileLabel ? `ARQUIVO: ${storageStatus}` : 'CONECTAR JSON'}</button>
          <button onClick={onExport} title="Exportar dados" style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--mu)', fontSize: '10px', padding: '2px 8px', cursor: 'pointer', letterSpacing: '0.05em', transition: 'all .12s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cyn)'; e.currentTarget.style.color = 'var(--cyn)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.color = 'var(--mu)'; }}>EXPORTAR</button>
          <button onClick={onImport} title="Importar dados" style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--mu)', fontSize: '10px', padding: '2px 8px', cursor: 'pointer', letterSpacing: '0.05em', transition: 'all .12s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yel)'; e.currentTarget.style.color = 'var(--yel)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.color = 'var(--mu)'; }}>IMPORTAR</button>
        </div>
        <span style={{ color: 'var(--mu)' }}>{ts}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function Sidebar({ subjects, activeSubject, onSelect, onAdd, cards }) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const doAdd = () => { const n = name.trim(); if (!n) return; onAdd(n); setName(''); setAdding(false); };
  const cnt = s => cards.filter(c => c.subject === s).length;
  const due = s => cards.filter(c => c.subject === s && isDue(c)).length;
  const allDue = cards.filter(isDue).length;
  const pct = s => { const sc = cards.filter(c => c.subject === s), tot = sc.reduce((a, c) => a + c.correct + c.wrong + (c.hard || 0) + (c.easy || 0), 0), cor = sc.reduce((a, c) => a + c.correct + (c.easy || 0), 0); return tot === 0 ? null : Math.round(cor / tot * 100); };
  return (
    <div style={{ width: '220px', flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px 9px', borderBottom: '1px solid var(--bd)', fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.12em' }}>ASSUNTOS</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {[{ label: '[ TODOS ]', s: null, d: allDue, total: cards.length, p: null }, ...subjects.map(s => ({ label: s, s, d: due(s), total: cnt(s), p: pct(s) }))].map(({ label, s, d, total, p }) => {
          const active = activeSubject === s;
          return (
            <div key={label} onClick={() => onSelect(s)} style={{ padding: '8px 16px', cursor: 'pointer', background: active ? 'var(--gf)' : 'transparent', borderLeft: `2px solid ${active ? 'var(--g)' : 'transparent'}`, transition: 'background .1s' }} onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#0d180d'; }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: active ? 'var(--g)' : 'var(--gd)', fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{label}</span>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                  {d > 0 && <span style={{ fontSize: '10px', background: 'var(--gm)', color: 'var(--g)', padding: '0 4px' }}>{d}</span>}
                  <span style={{ fontSize: '10px', color: 'var(--mu)' }}>{total}</span>
                </div>
              </div>
              {p !== null && <div style={{ marginTop: '4px', height: '2px', background: 'var(--bg3)' }}><div style={{ height: '100%', width: `${p}%`, background: p >= 80 ? 'var(--cyn)' : p >= 50 ? 'var(--g)' : 'var(--yel)', transition: 'width .3s' }} /></div>}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '12px', borderTop: '1px solid var(--bd)' }}>
        {adding ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <TInput value={name} onChange={setName} placeholder="nome do assunto..." autoFocus onKeyDown={e => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') setAdding(false); }} />
          <div style={{ display: 'flex', gap: '6px' }}><TBtn onClick={doAdd} sm>[ OK ]</TBtn><TBtn onClick={() => setAdding(false)} color="muted" sm>[ ESC ]</TBtn></div>
        </div> : <TBtn onClick={() => setAdding(true)} color="cyan" sm>[ + NOVO ASSUNTO ]</TBtn>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function AnkiChart({ history, cards }) {
  const [tab, setTab] = React.useState('dias');
  const [offset, setOffset] = React.useState(0);
  const tabs = ['dias', 'meses', 'ano', 'assunto'];
  const td = today();
  React.useEffect(() => setOffset(0), [tab]);

  const chartData = React.useMemo(() => {
    if (tab === 'dias') {
      return Array.from({ length: 14 }, (_, i) => {
        const d = dateOffset(i - 7 + (offset * 14));
        const dk = localDateKey(d);
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const isFuture = dk > td, isToday = dk === td;
        if (isFuture) {
          const forecast = cards.filter(c => dueDateKey(c) === dk).length;
          return { key: dk, label, reviewed: 0, correct: 0, forecast, isFuture: true, isToday: false };
        } else {
          const entries = history.filter(h => h.date === dk);
          return { key: dk, label, reviewed: entries.reduce((a, h) => a + h.reviewed, 0), correct: entries.reduce((a, h) => a + h.correct, 0), forecast: isToday ? cards.filter(isDue).length : 0, isFuture: false, isToday };
        }
      });
    }
    if (tab === 'meses') {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11 - i) + (offset * 12));
        const mk = localDateKey(d).slice(0, 7);
        const entries = history.filter(h => h.date.startsWith(mk));
        return { key: mk, label: d.toLocaleDateString('pt-BR', { month: 'short' }), reviewed: entries.reduce((a, h) => a + h.reviewed, 0), correct: entries.reduce((a, h) => a + h.correct, 0), isFuture: false, forecast: 0 };
      });
    }
    if (tab === 'ano') {
      const baseYear = new Date().getFullYear() + (offset * 6);
      const years = Array.from({ length: 6 }, (_, i) => String(baseYear - 5 + i));
      return years.map(yr => { const e = history.filter(h => h.date.startsWith(yr)); return { key: yr, label: yr, reviewed: e.reduce((a, h) => a + h.reviewed, 0), correct: e.reduce((a, h) => a + h.correct, 0), isFuture: false, forecast: 0 }; });
    }
    const subjects = [...new Set(cards.map(c => c.subject))];
    return subjects.map(s => { const e = history.filter(h => h.subject === s); return { key: s, label: s.length > 9 ? s.slice(0, 9) + '...' : s, reviewed: e.reduce((a, h) => a + h.reviewed, 0), correct: e.reduce((a, h) => a + h.correct, 0), isFuture: false, forecast: 0 }; });
  }, [tab, offset, history, cards, td]);

  const maxVal = Math.max(...chartData.map(d => Math.max(d.reviewed, d.forecast)), 1);
  const totRev = chartData.filter(d => !d.isFuture).reduce((a, d) => a + d.reviewed, 0);
  const totCor = chartData.filter(d => !d.isFuture).reduce((a, d) => a + d.correct, 0);
  const totFore = chartData.filter(d => d.isFuture).reduce((a, d) => a + d.forecast, 0);
  const gPct = totRev === 0 ? null : Math.round(totCor / totRev * 100);
  const W = 500, H = 130, PL = 6, PR = 6, PT = 10, PB = 26;
  const iW = W - PL - PR, iH = H - PT - PB, n = chartData.length, bw = Math.max(4, Math.floor(iW / n) - 3);

  return (
    <div style={{ border: '1px solid var(--bd)', background: 'var(--bg2)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '0.12em' }}>HISTORICO DE REVISAO</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {tab !== 'assunto' && <button onClick={() => setOffset(o => o - 1)} style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--mu)', fontSize: '10px', padding: '2px 7px', cursor: 'pointer' }}>&lt;</button>}
          {tabs.map(t => <TabBtn key={t} label={t.toUpperCase()} active={tab === t} onClick={() => setTab(t)} />)}
          {tab !== 'assunto' && <button onClick={() => setOffset(0)} disabled={offset === 0} title="Periodo atual" style={{ background: 'transparent', border: '1px solid var(--bd)', color: offset === 0 ? '#1a2e1a' : 'var(--g)', fontSize: '10px', padding: '2px 7px', cursor: offset === 0 ? 'default' : 'pointer' }}>HOJE</button>}
          {tab !== 'assunto' && <button onClick={() => setOffset(o => o + 1)} style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--mu)', fontSize: '10px', padding: '2px 7px', cursor: 'pointer' }}>&gt;</button>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '11px' }}>
        <span style={{ color: 'var(--mu)' }}>revistos: <span style={{ color: 'var(--g)' }}>{totRev}</span></span>
        {gPct !== null && <span style={{ color: 'var(--mu)' }}>acertos: <span style={{ color: 'var(--cyn)' }}>{gPct}%</span></span>}
        {tab === 'dias' && totFore > 0 && <span style={{ color: 'var(--mu)' }}>previsao: <span style={{ color: 'var(--yel)' }}>{totFore} cards</span></span>}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={PL} x2={W - PR} y1={PT + iH * (1 - f)} y2={PT + iH * (1 - f)} stroke="#1a2e1a" strokeWidth="0.5" />)}
        {tab === 'dias' && (() => { const todayIdx = chartData.findIndex(d => d.isToday); if (todayIdx < 0) return null; const x = PL + (iW / n) * todayIdx + (iW / n); return <line x1={x} x2={x} y1={PT} y2={PT + iH} stroke="var(--bdb)" strokeWidth="1" strokeDasharray="3 3" />; })()}
        {chartData.map((d, i) => {
          const x = PL + (iW / n) * i + (iW / n - bw) / 2;
          const val = d.isFuture ? d.forecast : d.reviewed;
          const bH = Math.max(val > 0 ? 2 : 0, (val / maxVal) * iH);
          const y = PT + iH - bH;
          const bc = d.isFuture ? '#ffd700' : d.reviewed === 0 ? 'var(--bdb)' : d.correct / Math.max(d.reviewed, 1) >= 0.8 ? '#00ffcc' : d.correct / Math.max(d.reviewed, 1) >= 0.5 ? '#00ff41' : '#ffd700';
          const cH = d.isFuture ? 0 : d.reviewed === 0 ? 0 : (d.correct / d.reviewed) * bH;
          return (
            <g key={d.key}>
              {bH > 0 && <rect x={x} y={y} width={bw} height={bH} fill={d.isFuture ? '#ffd70012' : '#ff444014'} stroke={d.isFuture ? '#ffd70060' : 'none'} strokeWidth="0.5" strokeDasharray={d.isFuture ? '2 2' : ''} />}
              {cH > 0 && <rect x={x} y={y + bH - cH} width={bw} height={cH} fill={bc} opacity={0.85} />}
              {d.isToday && d.forecast > 0 && (() => { const fH = Math.max(2, (d.forecast / maxVal) * iH); const fw = Math.max(2, bw / 2 - 1); return <rect x={x + bw / 2 + 1} y={PT + iH - fH} width={fw} height={fH} fill="none" stroke="#ffd70080" strokeWidth="0.5" strokeDasharray="2 2" />; })()}
              {val > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fill={d.isFuture ? '#ffd70080' : 'var(--mu)'} fontSize="7">{val}</text>}
              <text x={x + bw / 2} y={H - 2} textAnchor="middle" fill={d.isToday ? 'var(--g)' : 'var(--mu)'} fontSize={tab === 'assunto' ? 7 : 8} fontWeight={d.isToday ? 600 : 400}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      {tab === 'dias' && <div style={{ display: 'flex', gap: '14px', fontSize: '10px', color: 'var(--mu)', marginTop: '5px' }}>
        <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--cyn)', opacity: .8, marginRight: '3px' }}></span>acertos</span>
        <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ff4444', opacity: .15, marginRight: '3px' }}></span>erros</span>
        <span><span style={{ display: 'inline-block', width: '8px', height: '8px', border: '1px dashed #ffd70060', marginRight: '3px' }}></span>previsao futura</span>
        <span style={{ color: 'var(--g)', fontSize: '9px' }}>| = hoje</span>
      </div>}
    </div>
  );
}

// ------------------------------------------------------------
function PomodoroChart({ pomodoroHistory, subjects }) {
  const [tab, setTab] = React.useState('dias');
  const [offset, setOffset] = React.useState(0);
  const tabs = ['dias', 'semanas', 'meses', 'assunto'];
  React.useEffect(() => setOffset(0), [tab]);
  const focusLabel = minutes => { if (!minutes) return '-'; if (minutes < 60) return `${minutes}m`; return `${Math.round((minutes / 60) * 10) / 10}h`; };

  const chartData = React.useMemo(() => {
    if (tab === 'dias') {
      return Array.from({ length: 14 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (13 - i) + (offset * 14));
        const dk = localDateKey(d);
        const entries = pomodoroHistory.filter(h => h.date === dk);
        return { key: dk, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), count: entries.reduce((a, h) => a + h.count, 0), minutes: entries.reduce((a, h) => a + h.minutes, 0) };
      });
    }
    if (tab === 'semanas') {
      return Array.from({ length: 8 }, (_, i) => {
        const start = new Date(); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (7 * (7 - i)) + (offset * 56));
        const end = new Date(start); end.setDate(start.getDate() + 6);
        const wk = localDateKey(start);
        const entries = pomodoroHistory.filter(h => weekKey(new Date(`${h.date}T00:00:00`)) === wk);
        return { key: wk, label: `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}-${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`, count: entries.reduce((a, h) => a + h.count, 0), minutes: entries.reduce((a, h) => a + h.minutes, 0) };
      });
    }
    if (tab === 'meses') {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11 - i) + (offset * 12));
        const mk = localDateKey(d).slice(0, 7);
        const entries = pomodoroHistory.filter(h => h.date.startsWith(mk));
        return { key: mk, label: d.toLocaleDateString('pt-BR', { month: 'short' }), count: entries.reduce((a, h) => a + h.count, 0), minutes: entries.reduce((a, h) => a + h.minutes, 0) };
      });
    }
    return subjects.map(s => {
      const entries = pomodoroHistory.filter(h => h.subject === s);
      return { key: s, label: s.length > 9 ? s.slice(0, 9) + '...' : s, count: entries.reduce((a, h) => a + h.count, 0), minutes: entries.reduce((a, h) => a + h.minutes, 0) };
    });
  }, [tab, offset, pomodoroHistory, subjects]);

  const maxVal = Math.max(...chartData.map(d => d.minutes), 1);
  const totCount = chartData.reduce((a, d) => a + d.count, 0);
  const totMins = chartData.reduce((a, d) => a + d.minutes, 0);
  const W = 500, H = 110, PL = 6, PR = 6, PT = 10, PB = 26;
  const iW = W - PL - PR, iH = H - PT - PB, n = chartData.length, bw = Math.max(4, Math.floor(iW / n) - 3);

  return (
    <div style={{ border: '1px solid var(--bd)', borderTop: 'none', background: 'var(--bg2)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--oran)', letterSpacing: '0.12em' }}>POMODORO</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {tab !== 'assunto' && <button onClick={() => setOffset(o => o - 1)} style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--mu)', fontSize: '10px', padding: '2px 7px', cursor: 'pointer' }}>&lt;</button>}
          {tabs.map(t => <TabBtn key={t} label={t.toUpperCase()} active={tab === t} onClick={() => setTab(t)} color='var(--oran)' />)}
          {tab !== 'assunto' && <button onClick={() => setOffset(0)} disabled={offset === 0} title="Periodo atual" style={{ background: 'transparent', border: '1px solid var(--bd)', color: offset === 0 ? '#1a2e1a' : 'var(--oran)', fontSize: '10px', padding: '2px 7px', cursor: offset === 0 ? 'default' : 'pointer' }}>HOJE</button>}
          {tab !== 'assunto' && <button onClick={() => setOffset(o => o + 1)} style={{ background: 'transparent', border: '1px solid var(--bd)', color: 'var(--mu)', fontSize: '10px', padding: '2px 7px', cursor: 'pointer' }}>&gt;</button>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '11px' }}>
        <span style={{ color: 'var(--mu)' }}>sessoes: <span style={{ color: 'var(--oran)' }}>{totCount}</span></span>
        <span style={{ color: 'var(--mu)' }}>foco: <span style={{ color: 'var(--yel)' }}>{focusLabel(totMins)}</span></span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {[0.5, 1].map(f => <line key={f} x1={PL} x2={W - PR} y1={PT + iH * (1 - f)} y2={PT + iH * (1 - f)} stroke="#1a2e1a" strokeWidth="0.5" />)}
        {chartData.map((d, i) => {
          const x = PL + (iW / n) * i + (iW / n - bw) / 2;
          const bH = Math.max(d.minutes > 0 ? 2 : 0, (d.minutes / maxVal) * iH);
          const y = PT + iH - bH;
          return (
            <g key={d.key}>
              {bH > 0 && <rect x={x} y={y} width={bw} height={bH} fill="#ff8c0025" />}
              {bH > 0 && <rect x={x} y={y} width={bw} height={bH} fill="none" stroke="#ff8c00" strokeWidth="0.7" opacity={0.7} />}
              {d.minutes > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fill="var(--mu)" fontSize="7">{focusLabel(d.minutes)}</text>}
              <text x={x + bw / 2} y={H - 2} textAnchor="middle" fill="var(--mu)" fontSize={tab === 'assunto' || tab === 'semanas' ? 7 : 8}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
