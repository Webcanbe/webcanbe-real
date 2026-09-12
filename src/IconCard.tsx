import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function IconCard({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["default-8"]}>
        <div className={styles["div-11"]}>
          <SvgGraphic className={styles["icon"]} html={"<svg data-framer-name=\"Icon\" class=\"framer-CxKJY framer-qv8mvu\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw:var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255));--js9iwy:1.4;opacity:0.9\" data-f2c-idx=\"531\"><use href=\"#2039305298\" data-f2c-idx=\"532\"></use></svg>"} />
        </div>
        <div className={styles["text"]}>
          <div className={styles["title-6"]}>
            <h5 className={styles["h5"]}>{slots[0] ?? "Standard stack"}</h5>
          </div>
          <div className={styles["description-8"]}>
            <p className={styles["p-19"]}>{slots[1] ?? "Familiar frameworks and conventions.    Nothing proprietary to learn."}</p>
          </div>
        </div>
      </div>
  )
}
