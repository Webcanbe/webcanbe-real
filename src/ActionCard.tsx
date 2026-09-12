import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function ActionCard({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["default"]}>
        <div className={styles["title"]}>
          <SvgGraphic className={styles["svg-2"]} html={"<svg class=\"framer-1yehD framer-1ljtr54\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw: var(--token-7a4abf4f-f022-4317-96d1-4d64f8c7d124, rgba(255, 255, 255, 0.8)); --js9iwy: 1.8; opacity: 1;\" data-f2c-idx=\"118\"><use href=\"#3656053333\" data-f2c-idx=\"119\"></use></svg>"} />
          <div className={styles["heading"]}>
            <h6 className={styles["h6"]}>{slots[0] ?? "Start from something real"}</h6>
          </div>
        </div>
        <div className={styles["description"]}>
          <p className={styles["p-12"]}>{slots[1] ?? "Pick a project that already runs.       No blank page, no setup."}</p>
        </div>
      </div>
  )
}
