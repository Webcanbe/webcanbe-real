import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function ActionCard2({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["default-2"]}>
        <div className={styles["title-2"]}>
          <SvgGraphic className={styles["svg-2"]} html={"<svg class=\"framer-afxVx framer-1ljtr54\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw: var(--token-7a4abf4f-f022-4317-96d1-4d64f8c7d124, rgba(255, 255, 255, 0.8)); --js9iwy: 1.8; opacity: 1;\" data-f2c-idx=\"128\"><use href=\"#1153408925\" data-f2c-idx=\"129\"></use></svg>"} />
          <div className={styles["heading-2"]}>
            <h6 className={styles["h6-2"]}>{slots[0] ?? "Drag a box, change the code"}</h6>
          </div>
        </div>
        <div className={styles["description-2"]}>
          <p className={styles["p-13"]}>{slots[1] ?? "Canvas edits write straight into the source code. No prompting."}</p>
        </div>
      </div>
  )
}
