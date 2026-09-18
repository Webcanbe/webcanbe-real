import landscape from '../assets/landscape.svg'
import styles from './TrailCard.module.css'
export default function TrailCard({trail}){return <article className={styles.card}><img src={landscape} alt='Layered hills at dawn'/><div><small>{trail.distance} · {trail.level}</small><h2>{trail.name}</h2><p>{trail.description}</p></div></article>}
