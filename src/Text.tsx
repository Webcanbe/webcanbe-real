import styles from "./styles.module.css"

export default function Text({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["text-5"]} />
  )
}
