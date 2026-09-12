import styles from "./styles.module.css"

export default function ContentCard({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["default-4"]}>
        <div className={styles["image"]}>
          <div className={styles["div-7"]}>
            <img className={styles["img-3"]} src={slots[0] ?? "https://framerusercontent.com/images/QdBy8tuSCKn7z4p2vBgdPbChluY.png?scale-down-to=512&width=1056&height=808"} alt="" />
          </div>
        </div>
        <div className={styles["container-2"]}>
          <div className={styles["heading-5"]}>
            <div className={styles["indicator-3"]} />
            <div className={styles["title-5"]}>
              <h4 className={styles["h4"]}>{slots[1] ?? "Built to be edited"}</h4>
            </div>
          </div>
          <div className={styles["description-6"]}>
            <p className={styles["p-17"]}>{slots[2] ?? "Every project follows the same structure,       so the canvas works on all of them."}</p>
          </div>
        </div>
      </div>
  )
}
