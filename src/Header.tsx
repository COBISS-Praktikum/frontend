import './Header.css'

export function Header() {
  return (
    <header className="app-header">
      <div className="header-container">
        <h1 className="header-title">Organizational Graph Explorer</h1>
        <nav className="header-nav">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#features">Features</a>
        </nav>
      </div>
    </header>
  )
}

