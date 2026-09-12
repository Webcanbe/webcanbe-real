import styles from "./styles.module.css"

export default function Framer({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["logo-3"]} />
  )
}
