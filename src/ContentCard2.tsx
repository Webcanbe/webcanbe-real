import styles from "./styles.module.css"

export default function ContentCard2({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["default-5"]}>
        <div className={styles["image"]}>
          <div className={styles["div-7"]}>
            <img className={styles["img-3"]} src={slots[0] ?? "https://framerusercontent.com/images/e47XRTAfjoGkAOkb5PtDjlPw.png?scale-down-to=512&width=1056&height=808"} alt="" />
          </div>
        </div>
        <div className={styles["container-3"]}>
          <div className={styles["heading-5"]}>
            <div className={styles["indicator-3"]} />
            <div className={styles["title-5"]}>
              <h4 className={styles["h4"]}>{slots[1] ?? "Open it, don't unzip it"}</h4>
            </div>
          </div>
          <div className={styles["description-7"]}>
            <p className={styles["p-18"]}>{slots[2] ?? "Purchase goes straight into a workspace. No local setup before you can change a thing."}</p>
          </div>
        </div>
      </div>
  )
}
