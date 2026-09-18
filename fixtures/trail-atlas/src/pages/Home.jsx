import TrailCard from '../components/TrailCard'
import trails from '../data/trails.json'
import styles from './Home.module.css'
export default function Home(){return <main className={styles.page}><p>OUTSIDE, AT YOUR OWN PACE</p><h1>A good day begins with a trail.</h1><p>Short walks, practical notes, and places to pause.</p><section className={styles.cards}>{trails.map(trail=><TrailCard key={trail.name} trail={trail}/>)}</section></main>}
