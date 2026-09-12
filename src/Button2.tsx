import styles from "./styles.module.css"

export default function Button2({ slots = [] }: { slots?: string[] }) {
  return (
      <a className={styles["primary-3"]} href={slots[0] === "Open a project" ? "/browse" : "#overview"}>
        <div className={styles["get-started-3"]}>
          <p className={styles["p-11"]}>{slots[0] ?? "Open a project"}</p>
        </div>
      </a>
  )
}
