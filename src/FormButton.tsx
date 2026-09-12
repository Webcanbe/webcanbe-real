import styles from "./styles.module.css"

export default function FormButton({ slots = [] }: { slots?: string[] }) {
  return (
      <button className={styles["default-10"]}>
        <div className={styles["div-21"]}>
          <p className={styles["p-39"]}>{slots[0] ?? "Submit"}</p>
        </div>
      </button>
  )
}
