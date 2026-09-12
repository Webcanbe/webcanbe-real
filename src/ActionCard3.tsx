import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function ActionCard3({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["default-3"]}>
        <div className={styles["title-3"]}>
          <SvgGraphic className={styles["svg-2"]} html={"<svg class=\"framer-Jutkq framer-1ljtr54\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw: var(--token-7a4abf4f-f022-4317-96d1-4d64f8c7d124, rgba(255, 255, 255, 0.8)); --js9iwy: 1.8; opacity: 1;\" data-f2c-idx=\"138\"><use href=\"#1912074499\" data-f2c-idx=\"139\"></use></svg>"} />
          <div className={styles["heading-3"]}>
            <h6 className={styles["h6-3"]}>{slots[0] ?? "Canvas, code, or AI"}</h6>
          </div>
        </div>
        <div className={styles["description-3"]}>
          <p className={styles["p-14"]}>{slots[1] ?? "Three ways in. One codebase underneath. No hand-off."}</p>
        </div>
      </div>
  )
}
