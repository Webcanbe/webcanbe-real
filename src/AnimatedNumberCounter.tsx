import styles from "./styles.module.css"

export default function AnimatedNumberCounter({ slots = [] }: { slots?: string[] }) {
  return (
      <h3 className={styles["h3"]}>{slots[0] ?? "$0"}</h3>
  )
}
