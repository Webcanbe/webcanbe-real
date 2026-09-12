import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function FileTerminal({ slots = [] }: { slots?: string[] }) {
  return (
      <SvgGraphic className={styles["icon"]} html={"<svg data-framer-name=\"Icon\" class=\"framer-xysN6 framer-qv8mvu\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw:var(--token-cecf886f-35d1-4207-a045-acf7164ed7a9, rgb(255, 255, 255));--js9iwy:1.4;opacity:0.9\" data-f2c-idx=\"564\"><use href=\"#1255962382\" data-f2c-idx=\"565\"></use></svg>"} />
  )
}
