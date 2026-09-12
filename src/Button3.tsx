import styles from "./styles.module.css"

export default function Button3({ slots = [] }: { slots?: string[] }) {
  return (
      <a className={styles["primary-4"]}>
        <div className={styles["get-started-4"]}>
          <p className={styles["p-20"]}>{slots[0] ?? "Explore AI"}</p>
        </div>
      </a>
  )
}
