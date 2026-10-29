import { Link } from 'react-router-dom'
import inspiration from '../assets/dress-code-inspiration.png'

export default function DressCode() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Klädinspiration</h1>
        <p className="page-subtitle">Mörk kostym</p>
      </div>
      <Link to="/faq">Tillbaka till vanliga frågor</Link>
      <p className="dress-code-help">
        Klicka på bilden för att öppna den i full storlek i en ny flik.
      </p>
      <a href={inspiration} target="_blank" rel="noopener noreferrer">
        <img
          className="dress-code-image"
          src={inspiration}
          width="768"
          height="1152"
          alt="Klädguide för mörk kostym. För kvinnor: elegant klänning, kjol med fin överdel eller festlig byxdress, även i ljusare färger. För män: mörkblå, mörkgrå eller svart kostym med skjorta och slips. Finskor eller festliga skor och välvalda accessoarer. Undvik helvitt, jeans, sneakers och alltför avslappnade plagg."
        />
      </a>
    </div>
  )
}
