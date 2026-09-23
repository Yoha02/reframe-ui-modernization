const stages = ['Import', 'Evaluate', 'Decompose', 'Design system', 'Rebuild', 'Review', 'Publish'];

export default function App() {
  return <div className="studio">
    <header className="topbar">
      <a className="wordmark" href="/" aria-label="Reframe home"><span className="brandmark" aria-hidden="true">r</span>reframe<span className="wordmark-dot">.</span></a>
      <div className="topbar-divider" /><span className="workspace-label">Modernization studio</span>
      <span className="build-label">Workspace foundation</span>
    </header>
    <div className="studio-body">
      <aside className="stage-rail" aria-label="Modernization workflow">
        <p className="eyebrow">YOUR WORKSPACE</p>
        <p className="rail-title">A new perspective</p>
        <ol className="stage-list">{stages.map((stage, i) => <li key={stage} className={i === 0 ? 'current' : ''} aria-current={i === 0 ? 'step' : undefined}><span className="stage-index">{String(i + 1).padStart(2, '0')}</span>{stage}</li>)}</ol>
        <div className="rail-foot"><span className="small-mark" aria-hidden="true">↗</span><p>Preserve what matters.<br /><strong>Reimagine what’s possible.</strong></p></div>
      </aside>
      <main className="welcome">
        <div className="welcome-heading"><span className="eyebrow accent">A FRESH START</span><h1>Every interface has<br />a next chapter<span>.</span></h1><p>Understand the original. Find a new visual language.<br />Build something worth coming back to.</p></div>
        <section className="foundation-card" aria-labelledby="foundation-title"><div className="foundation-icon" aria-hidden="true">↗</div><div><h2 id="foundation-title">Your studio is taking shape</h2><p>The application foundation is ready. Evidence import and the review workflow are the next build steps.</p></div><span className="status-label">In development</span></section>
        <div className="principles"><section><span>01 / UNDERSTAND</span><h2>Start with the evidence.</h2><p>Keep the content, links, and details that make the original yours.</p></section><section><span>02 / REIMAGINE</span><h2>Give it a visual language.</h2><p>A considered design system, shaped by what your site needs.</p></section><section><span>03 / MAKE IT REAL</span><h2>Approve. Rebuild. Share.</h2><p>Stay in control, from the first color to the final page.</p></section></div>
        <footer className="workspace-footer"><span>REFRAME STUDIO</span><span>Built with Forge · Designed around your decisions</span></footer>
      </main>
    </div>
  </div>;
}
