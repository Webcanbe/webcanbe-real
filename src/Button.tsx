import styles from "./styles.module.css"

export default function Button({ slots = [] }: { slots?: string[] }) {
  return (
      <a className={styles["primary-2"]}>
        <div className={styles["get-started-2"]}>
          <p className={styles["p-10"]}>{slots[0] ?? "Get started"}</p>
        </div>
      </a>
  )
}
