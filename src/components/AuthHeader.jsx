import heroTopLeft from '../assets/botanical/hero_top_left.png'
import heroBottomRight from '../assets/botanical/hero_bottom_right.png'

export default function AuthHeader() {
  return (
    <div className="auth-header">
      <img className="home-floral home-floral--top-left" src={heroTopLeft} alt="" aria-hidden="true" />
      <img className="home-floral home-floral--bottom-right" src={heroBottomRight} alt="" aria-hidden="true" />
      <div className="home-hero-content">
        <p className="auth-app-name">June 5th</p>
        <h1 className="auth-couple"><span>Britta</span><span className="auth-ampersand">&amp;</span><span>Johanna</span></h1>
        <p className="auth-date">5 juni 2027 · Östergötland</p>
      </div>
    </div>
  )
}
