import styles from './Note.module.css'
export function Note({title, description}: {title: string; description: string}) {
  return <article className={styles.note}><small>FROM THE NOTEBOOK</small><h2>{title}</h2><p>{description}</p></article>
}
