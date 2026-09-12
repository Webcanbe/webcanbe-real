import styles from "./styles.module.css"

export default function Button4({ slots = [] }: { slots?: string[] }) {
  return (
      <a className={styles["primary-6"]}>
        <div className={styles["get-started-6"]}>
          <p className={styles["p-29"]}>{slots[0] ?? "Get Pro"}</p>
        </div>
      </a>
  )
}
